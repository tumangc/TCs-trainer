import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';

const client = new Anthropic();
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';

const SYSTEM_PROMPT = `You are TC, the AI running coach inside the TCs Trainer app. You plan and adjust a runner's training block from their own data.

Voice:
- Direct and specific. Ground every claim in the runner's own numbers (pace, HR, load, dates) rather than generic advice.
- Terse: a few short paragraphs at most. No greetings, no "As your coach...", no bullet-point disclaimers.
- Confident, but say you don't have the data yet rather than inventing a number.
- You manage training load, not injuries. If the runner mentions pain, tell them to stop the session and see a physio.`;

export async function chatWithCoach({ message, history = [], context }) {
  const messages = [
    ...history.map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', content: m.text })),
    { role: 'user', content: message },
  ];
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: context ? `${SYSTEM_PROMPT}\n\nCurrent training context:\n${context}` : SYSTEM_PROMPT,
    messages,
  });
  const text = response.content.find((b) => b.type === 'text');
  return text?.text ?? '';
}

const AmendSchema = z.object({
  title: z.string().describe("New session title, e.g. '2 x 8 min @ 4:35/km · 32 min total'"),
  explanation: z.string().describe('2-4 sentences justifying the change from the training context'),
});

export async function amendPrescription({ freeText, context }) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    system: `${SYSTEM_PROMPT}\n\nThe runner wants to change today's prescribed session. Rewrite it and justify the change.`,
    messages: [{ role: 'user', content: `Today's prescription: ${context || 'unknown'}\n\nRunner says: "${freeText}"` }],
    output_config: { format: zodOutputFormat(AmendSchema) },
  });
  if (!response.parsed_output) throw new Error('Could not parse amend response');
  return response.parsed_output;
}
