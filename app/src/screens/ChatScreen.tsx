import { useEffect, useRef, useState } from 'react';
import { useCoachService } from '../services/coachServiceContext';
import type { ChatData, ChatMessage } from '../types/domain';

export function ChatScreen() {
  const service = useCoachService();
  const [data, setData] = useState<ChatData | null>(null);
  const [log, setLog] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    service.getChat().then(setData);
  }, [service]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [log, thinking]);

  if (!data) return <div className="screen-loading muted">Loading TC…</div>;

  const messages = log ?? data.seed;

  const send = (text: string) => {
    if (!text.trim()) return;
    setLog(messages.concat([{ from: 'me', text: text.trim() }]));
    setDraft('');
    setThinking(true);
    service
      .sendChatMessage(text)
      .then(({ reply }) => {
        setThinking(false);
        setLog((prev) => (prev ?? messages).concat([{ from: 'tc', text: reply }]));
      })
      .catch((err: Error) => {
        setThinking(false);
        setLog((prev) => (prev ?? messages).concat([{ from: 'tc', text: `Couldn't reach TC: ${err.message}` }]));
      });
  };

  return (
    <div>
      <div className="eyebrow">Your coach · replies in seconds</div>
      <h3 style={{ margin: '5px 0 4px' }}>TC</h3>
      <p className="muted-70" style={{ fontSize: 12.5, lineHeight: 1.55, margin: '0 0 14px' }}>
        {data.intro}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start',
              maxWidth: '86%',
              padding: '9px 11px',
              borderRadius: 'var(--radius-md)',
              fontSize: 12.5,
              lineHeight: 1.55,
              whiteSpace: 'pre-line',
              background: m.from === 'me' ? 'var(--color-accent-800)' : 'var(--color-surface)',
              boxShadow: m.from === 'me' ? '0 0 0 1px var(--color-accent-700)' : '0 0 0 1px var(--color-divider)',
              color: 'var(--color-text)',
            }}
          >
            {m.text}
          </div>
        ))}
        {thinking && (
          <div className="tc-pulse muted" style={{ alignSelf: 'flex-start', fontSize: 12 }}>
            TC is reading your last four weeks…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="chip-row" style={{ marginTop: 14 }}>
        {data.prompts.map((label) => (
          <button key={label} type="button" className="tag tag-outline" style={{ background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => send(label)}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 7, marginTop: 12 }}>
        <input
          className="input"
          style={{ flex: 1, fontSize: 13 }}
          placeholder="Ask TC anything"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send(draft);
          }}
        />
        <button type="button" className="btn btn-primary" onClick={() => send(draft)}>
          Send
        </button>
      </div>
    </div>
  );
}
