import { MockCoachService } from './mockCoachService';
import { getStravaInsights, getStravaStatus } from './stravaClient';
import type {
  AmendResult,
  ChatMessage,
  GoalKind,
  ModelData,
  OnboardingConstraints,
  OnboardingData,
  OnboardingFitness,
  OnboardingGoal,
  ProfileData,
} from '../types/domain';

function persistOnboarding(patch: Record<string, unknown>) {
  fetch('/api/user', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ onboarding: patch }),
  }).catch((err) => console.error('Failed to persist onboarding change', err));
}

/**
 * Extends the mock for structured/UI-state data (plan, progress, profile, ...)
 * but routes the two free-text surfaces — chat and "amend today's session" —
 * through the real backend, which calls Claude server-side. Onboarding reads
 * and writes are also synced with the backend's single-user JSON store, so
 * the runner's setup survives a page reload or restart instead of living
 * only in this instance's memory.
 */
export class LiveCoachService extends MockCoachService {
  private chatHistory: ChatMessage[] = [];
  private todayContext = '';
  private onboardingSeeded: Promise<void> | null = null;

  private seedOnboardingFromBackend(): Promise<void> {
    if (!this.onboardingSeeded) {
      this.onboardingSeeded = (async () => {
        const res = await fetch('/api/user');
        if (!res.ok) return;
        const user = await res.json();
        const o = user.onboarding;
        if (!o) return;
        await super.setOnboardingGoalKind(o.goalKind);
        await super.updateOnboardingGoal({ race: o.race, date: o.date, goalTime: o.goalTime });
        await super.updateOnboardingConstraints({ offDays: o.offDays, timeCap: o.timeCap, cross: o.cross, recurring: o.recurring });
        await super.updateOnboardingFitness({
          recentRaceDist: o.recentRaceDist,
          recentRaceTime: o.recentRaceTime,
          weeklyKm: o.weeklyKm,
          yearsRunning: o.yearsRunning,
        });
      })().catch((err) => console.error('Failed to load persisted onboarding data', err));
    }
    return this.onboardingSeeded;
  }

  async getOnboarding(): Promise<OnboardingData> {
    await this.seedOnboardingFromBackend();
    return super.getOnboarding();
  }

  async setOnboardingGoalKind(kind: GoalKind): Promise<OnboardingGoal> {
    const result = await super.setOnboardingGoalKind(kind);
    persistOnboarding({ goalKind: kind });
    return result;
  }

  async updateOnboardingGoal(patch: Partial<Pick<OnboardingGoal, 'race' | 'date' | 'goalTime'>>): Promise<OnboardingGoal> {
    const result = await super.updateOnboardingGoal(patch);
    persistOnboarding(patch);
    return result;
  }

  async updateOnboardingConstraints(
    patch: Partial<Pick<OnboardingConstraints, 'offDays' | 'timeCap' | 'cross' | 'recurring'>>,
  ): Promise<OnboardingConstraints> {
    const result = await super.updateOnboardingConstraints(patch);
    persistOnboarding(patch);
    return result;
  }

  async updateOnboardingFitness(
    patch: Partial<Pick<OnboardingFitness, 'recentRaceDist' | 'recentRaceTime' | 'weeklyKm' | 'yearsRunning'>>,
  ): Promise<OnboardingFitness> {
    const result = await super.updateOnboardingFitness(patch);
    persistOnboarding(patch);
    return result;
  }

  async importFitnessFromWatch(): Promise<OnboardingFitness> {
    const result = await super.importFitnessFromWatch();
    persistOnboarding({
      recentRaceDist: result.recentRaceDist,
      recentRaceTime: result.recentRaceTime,
      weeklyKm: result.weeklyKm,
      yearsRunning: result.yearsRunning,
    });
    return result;
  }

  async completeOnboarding(): Promise<void> {
    await super.completeOnboarding();
    await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hasCompletedOnboarding: true }),
    }).catch((err) => console.error('Failed to persist onboarding completion', err));
  }

  async getToday() {
    const data = await super.getToday();
    this.todayContext = `${data.prescription.title} — ${data.prescription.subtitle}`;
    return data;
  }

  async getChat() {
    const data = await super.getChat();
    this.chatHistory = [...data.seed];
    return data;
  }

  async sendChatMessage(text: string): Promise<{ reply: string }> {
    const res = await fetch('/api/coach/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: this.chatHistory, context: this.todayContext }),
    });
    if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);
    const { reply } = await res.json();
    this.chatHistory = [...this.chatHistory, { from: 'me', text }, { from: 'tc', text: reply }];
    return { reply };
  }

  async submitAmend(freeText: string): Promise<AmendResult> {
    const res = await fetch('/api/coach/amend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ freeText, context: this.todayContext }),
    });
    if (!res.ok) throw new Error(`Amend request failed: ${res.status}`);
    return res.json();
  }

  async getModel(): Promise<ModelData> {
    const fallback = await super.getModel();
    const status = await getStravaStatus();
    if (!status.connected) return fallback;

    const insights = await getStravaInsights();
    if (!insights.ok || !insights.beliefs) return fallback;

    return {
      intro: "Every belief below is inferred from your connected Strava data — not the illustrative defaults. Tap one to see what it's built from.",
      beliefs: insights.beliefs,
    };
  }

  async getProfile(): Promise<ProfileData> {
    const data = await super.getProfile();
    const status = await getStravaStatus();
    if (!status.connected) return data;

    const insights = await getStravaInsights();
    if (!insights.ok) return data;

    const thresholds = data.thresholds.map((t) => {
      if (t.label === 'Threshold pace' && insights.thresholdPace) {
        return { ...t, value: insights.thresholdPace, source: 'Strava' };
      }
      if (t.label === 'Max HR seen' && insights.maxHr) {
        return { ...t, value: `${insights.maxHr} bpm`, source: 'Strava' };
      }
      return t;
    });
    return { ...data, thresholds };
  }
}
