import { MockCoachService } from './mockCoachService';
import type { AmendResult, ChatMessage } from '../types/domain';

/**
 * Extends the mock for structured/UI-state data (plan, progress, profile, ...)
 * but routes the two free-text surfaces — chat and "amend today's session" —
 * through the real backend, which calls Claude server-side.
 */
export class LiveCoachService extends MockCoachService {
  private chatHistory: ChatMessage[] = [];
  private todayContext = '';

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
}
