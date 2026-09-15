import { useEffect, useState } from 'react';
import { useCoachService } from '../services/coachServiceContext';
import type { TodayData } from '../types/domain';

const AMEND_PRESETS = ['Only have 40 minutes', 'Legs feel flat', 'Move it to tomorrow', 'Treadmill only'];

export function TodayScreen({ isFull, onSetDensity }: { isFull: boolean; onSetDensity: (full: boolean) => void }) {
  const service = useCoachService();
  const [data, setData] = useState<TodayData | null>(null);

  const [amendOpen, setAmendOpen] = useState(false);
  const [amendDraft, setAmendDraft] = useState('');
  const [amendThinking, setAmendThinking] = useState(false);
  const [amendResult, setAmendResult] = useState<{ title: string; explanation: string } | null>(null);
  const [acceptedAmend, setAcceptedAmend] = useState<{ title: string; explanation: string } | null>(null);
  const accepted = acceptedAmend !== null;
  const [sent, setSent] = useState(false);

  const [answered, setAnswered] = useState<string[]>([]);
  const [lastAck, setLastAck] = useState('');

  useEffect(() => {
    service.getToday().then(setData);
  }, [service]);

  if (!data) {
    return <div className="screen-loading muted">Loading today…</div>;
  }

  const runAmend = (text: string) => {
    if (!text.trim()) return;
    setAmendThinking(true);
    setAmendOpen(false);
    setAmendDraft(text);
    service
      .submitAmend(text)
      .then((result) => {
        setAmendThinking(false);
        setAmendResult(result);
      })
      .catch((err: Error) => {
        setAmendThinking(false);
        setAmendResult({ title: 'Could not reach TC', explanation: err.message });
      });
  };

  const acceptAmend = () => {
    if (amendResult) setAcceptedAmend(amendResult);
    setAmendResult(null);
    setSent(false);
  };

  const answerQuestion = (id: string, label: string) => {
    service.answerQuestion(id, label).then(({ acknowledgement }) => {
      setAnswered((prev) => [...prev, id]);
      setLastAck(acknowledgement);
    });
  };

  const pending = data.openQuestions.filter((q) => !answered.includes(q.id));
  const rxRows = isFull ? data.prescription.rowsFull : data.prescription.rowsSimple;
  const rxTitle = accepted ? amendTitleParts(acceptedAmend?.title).title : data.prescription.title;
  const rxSub = accepted
    ? 'Revised at your request · ' + amendTitleParts(acceptedAmend?.title).sub
    : data.prescription.subtitle;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="eyebrow">{data.dateLabel}</div>
          <h3 style={{ margin: '5px 0 0' }}>{data.sessionLabel}</h3>
        </div>
        <div className="seg density-toggle">
          <button type="button" aria-pressed={!isFull} onClick={() => onSetDensity(false)}>
            Simple
          </button>
          <button type="button" aria-pressed={isFull} onClick={() => onSetDensity(true)}>
            Full
          </button>
        </div>
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-3)', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div className="card-kicker" style={{ margin: 0 }}>
            {data.prescription.kicker}
          </div>
          <span className="tag tag-accent" style={{ fontSize: 9.5, padding: '2px 7px' }}>
            {accepted ? 'Amended 06:42' : data.prescription.revisedTag}
          </span>
        </div>
        <div style={{ fontSize: 21, fontFamily: 'var(--font-heading)', lineHeight: 1.18 }}>
          {rxTitle}
          <br />
          <span style={{ fontSize: 14 }} className="muted">
            {rxSub}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {(accepted ? amendRows(acceptedAmend?.title) : rxRows).map((row, i) => (
            <div key={i} className="row-rule" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5 }}>
              <span className="muted">{row.label}</span>
              <span className="tabular">{row.value}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => service.sendPrescriptionToWatch().then(() => setSent(true))}
          >
            {sent ? 'Sent to watch ✓' : 'Send to watch'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setAmendOpen((v) => !v)}>
            Amend
          </button>
        </div>

        {amendOpen && (
          <div className="tc-rise" style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="muted" style={{ fontSize: 11.5 }}>
              Tell TC what's changed. It rewrites the session and says what it costs.
            </div>
            <textarea
              className="input"
              style={{ minHeight: 64, fontSize: 13 }}
              placeholder="e.g. only have 40 minutes this morning"
              value={amendDraft}
              onChange={(e) => setAmendDraft(e.target.value)}
            />
            <div className="chip-row">
              {AMEND_PRESETS.map((label) => (
                <button key={label} type="button" className="tag tag-outline" style={{ background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => runAmend(label)}>
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-primary btn-block" onClick={() => runAmend(amendDraft)}>
              Send to TC
            </button>
          </div>
        )}

        {amendThinking && (
          <div className="tc-pulse muted" style={{ fontSize: 12.5 }}>
            TC is rewriting the session…
          </div>
        )}

        {amendResult && !accepted && (
          <div className="card tc-note tc-rise" style={{ gap: 'var(--space-2)' }}>
            <div className="tc-note-label">TC · revised session</div>
            <div style={{ fontSize: 14, fontFamily: 'var(--font-heading)' }}>{amendResult.title}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'color-mix(in srgb,var(--color-text) 85%,transparent)' }}>
              {amendResult.explanation}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={acceptAmend}>
                Accept
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setAmendResult(null)}>
                Keep original
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-2)', marginBottom: 10 }}>
        <div className="card-kicker" style={{ margin: 0 }}>
          Basis for this session
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, lineHeight: 1.5 }}>
          {data.basis.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 9 }}>
              <span className="tabular" style={{ color: 'var(--color-accent-300)' }}>
                {b.value}
              </span>
              <span className="muted-70">{b.note}</span>
            </div>
          ))}
        </div>
        {isFull && (
          <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 9, fontSize: 12.5, lineHeight: 1.6, color: 'color-mix(in srgb,var(--color-text) 82%,transparent)' }}>
            {data.basisExplainer}
            <div className="tc-signoff">— TC</div>
          </div>
        )}
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="card-kicker" style={{ margin: 0 }}>
            Open questions · {pending.length}
          </div>
          <span className="muted" style={{ fontSize: 11 }}>
            {pending.length ? data.questionsScope : 'All answered'}
          </span>
        </div>
        {pending.map((q) => (
          <div key={q.id} className="row-rule" style={{ padding: '8px 0' }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{q.text}</div>
            <div className="chip-row" style={{ marginTop: 8 }}>
              {q.answers.map((label) => (
                <button key={label} type="button" className="tag tag-outline" style={{ background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => answerQuestion(q.id, label)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
        {lastAck && (
          <div className="tc-rise" style={{ fontSize: 12.5, lineHeight: 1.55, color: 'color-mix(in srgb,var(--color-text) 82%,transparent)' }}>
            {lastAck}
          </div>
        )}
      </div>
    </div>
  );
}

function amendTitleParts(title?: string) {
  if (!title) return { title: '', sub: '' };
  const [t, ...rest] = title.split(' · ');
  return { title: t, sub: rest.join(' · ') };
}

function amendRows(title: string | undefined) {
  if (!title) return [];
  return [
    { label: 'Volume', value: '8.1 km · 42 min' },
    { label: 'Intensity', value: 'Z4 · 16 min at threshold' },
    { label: 'Planned load', value: '64 TSS · wk 398' },
  ];
}
