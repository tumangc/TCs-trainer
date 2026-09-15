import type {
  AmendResult,
  AnalysisData,
  ChatData,
  GoalKind,
  ModelData,
  NotificationsData,
  OnboardingConstraints,
  OnboardingData,
  OnboardingFitness,
  OnboardingGoal,
  PlanData,
  ProfileData,
  ProgressData,
  TodayData,
} from '../types/domain';

/**
 * The seam between the UI and TC's brain. MockCoachService fulfills this
 * with canned data and pattern-matched replies; a real implementation
 * would call an API/LLM backend instead. Screens depend only on this
 * interface, never on the mock directly.
 */
export interface CoachService {
  getToday(): Promise<TodayData>;
  sendPrescriptionToWatch(): Promise<void>;
  submitAmend(freeText: string): Promise<AmendResult>;
  answerQuestion(questionId: string, answerLabel: string): Promise<{ acknowledgement: string }>;

  getPlan(): Promise<PlanData>;
  dismissPlanChange(): Promise<void>;

  getProgress(): Promise<ProgressData>;

  getRunAnalysis(id: string): Promise<AnalysisData>;

  getOnboarding(): Promise<OnboardingData>;
  setOnboardingGoalKind(kind: GoalKind): Promise<OnboardingGoal>;
  updateOnboardingConstraints(
    patch: Partial<Pick<OnboardingConstraints, 'offDays' | 'timeCap' | 'cross'>>,
  ): Promise<OnboardingConstraints>;
  importFitnessFromWatch(): Promise<OnboardingFitness>;
  completeOnboarding(): Promise<void>;

  getChat(): Promise<ChatData>;
  sendChatMessage(text: string): Promise<{ reply: string }>;

  getModel(): Promise<ModelData>;

  getProfile(): Promise<ProfileData>;

  getNotifications(): Promise<NotificationsData>;
  setNotificationToggle(label: string, on: boolean): Promise<void>;
}
