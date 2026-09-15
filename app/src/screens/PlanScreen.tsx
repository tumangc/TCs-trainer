import { useEffect, useState } from 'react';
import { useCoachService } from '../services/coachServiceContext';
import type { PlanData } from '../types/domain';
import { BarChart } from '../components/shared/Charts';

const PHASE_COLORS: Record<string, string> = {
  done: 'var(--color-accent)',
  current: 'var(--color-accent-700)',
  upcoming: 'var(--color-neutral-800)',
};

export function PlanScreen({ onOpenAnalysis }: { onOpenAnalysis: (id: string) => void }) {
  const service = useCoachService();
  const [data, setData] = useState<PlanData | null>(null);
  const [blockOpen, setBlockOpen] = useState(true);
  const [changeDismissed, setChangeDismissed] = useState(false);

  useEffect(() => {
    service.getPlan().then(setData);
  }, [service]);

  if (!data) return <div className="screen-loading muted">Loading plan…</div>;

  const { block } = data;

  return (
    <div>
      <div className="eyebrow">{block.raceLabel}</div>
      <div className="screen-title-row">
        <h3 style={{ margin: 0 }}>{block.weekLabel}</h3>
        <div className="muted tabular" style={{ fontSize: 12.5 }}>
          {block.daysOut} days out
        </div>
      </div>

      <button
        type="button"
        className="card elev-sm"
        style={{ width: '100%', border: 0, cursor: 'pointer', fontFamily: 'inherit', color: 'inherit', textAlign: 'left', gap: 'var(--space-3)', marginBottom: 10 }}
        onClick={() => setBlockOpen((v) => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="card-kicker" style={{ margin: 0 }}>
            Block overview
          </div>
          <span style={{ fontSize: 11, color: 'var(--color-accent)' }}>{blockOpen ? 'Collapse' : 'Expand'}</span>
        </div>
        <div className="phase-bar">
          {block.phases.map((p, i) => (
            <div key={i} className="phase-bar-seg" style={{ flex: p.fraction, background: PHASE_COLORS[p.state] }} />
          ))}
        </div>
        <div className="phase-labels">
          {block.phases.map((p, i) => (
            <span key={i}>
              {p.label} {p.weeks}
            </span>
          ))}
        </div>

        {blockOpen && (
          <div className="tc-rise" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--color-divider)', paddingTop: 11 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }} className="muted">
                <span>Weekly load ramp</span>
                <span className="tabular">
                  {block.weeklyLoad.value} this week · +{block.weeklyLoad.deltaPct}%
                </span>
              </div>
              <BarChart values={block.weeklyLoad.bars} highlightIndex={block.weeklyLoad.currentIndex} height={66} />
            </div>
            <div>
              <div style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7 }} className="muted">
                Key sessions remaining · {block.keySessionsRemaining}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
                {block.keySessions.map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{s.title}</span>
                    <span className={s.highlighted ? 'tabular' : 'muted tabular'} style={s.highlighted ? { color: 'var(--color-accent-300)' } : undefined}>
                      {s.when}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </button>

      {data.changeNotice && !changeDismissed && (
        <div className="card elev-sm" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div className="tc-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)', flex: 'none' }} />
          <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.45 }}>{data.changeNotice.message}</div>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setChangeDismissed(true)}>
            Undo
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 4px' }}>
        <div className="muted" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {data.weekSummary}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 12 }}>
            ‹
          </button>
          <button type="button" className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: 12 }}>
            ›
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {data.sessions.map((s) => {
          const markColor =
            s.emphasis === 'accent' ? 'var(--color-accent)' : s.emphasis === 'accent-dim' ? 'var(--color-accent-700)' : 'var(--color-neutral-800)';
          const statusColor = s.status === 'Fast' ? 'var(--color-accent-300)' : s.status === 'Today' ? 'var(--color-accent)' : undefined;
          return (
            <div
              key={s.id}
              className="list-row row-rule"
              style={{ cursor: s.analysisId ? 'pointer' : 'default' }}
              onClick={s.analysisId ? () => onOpenAnalysis(s.analysisId!) : undefined}
            >
              <div className="list-row-day">{s.day}</div>
              <div className="list-row-mark" style={{ background: markColor }} />
              <div className="list-row-main">
                <div className="list-row-title" style={{ color: s.status === 'Today' ? 'var(--color-accent)' : undefined }}>
                  {s.title}
                </div>
                <div className="list-row-detail">{s.detail}</div>
              </div>
              <div className="list-row-end">
                <div className="list-row-status" style={{ color: statusColor }}>
                  {s.status}
                </div>
                <div className="list-row-load">{s.load ?? '—'}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
