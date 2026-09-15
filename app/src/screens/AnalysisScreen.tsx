import { useEffect, useState } from 'react';
import { useCoachService } from '../services/coachServiceContext';
import type { AnalysisData } from '../types/domain';
import { LineChart } from '../components/shared/Charts';

const ACCENT = '#9184d9';
const NEUTRAL_LINE = '#b2b6ca';

export function AnalysisScreen({ id, onBack, onAskTc }: { id: string; onBack: () => void; onAskTc: () => void }) {
  const service = useCoachService();
  const [data, setData] = useState<AnalysisData | null>(null);

  useEffect(() => {
    service.getRunAnalysis(id).then(setData);
  }, [service, id]);

  if (!data) return <div className="screen-loading muted">Loading analysis…</div>;

  return (
    <div>
      <button type="button" className="btn btn-ghost" style={{ padding: '2px 0', fontSize: 12, marginBottom: 10 }} onClick={onBack}>
        ‹ Back to plan
      </button>
      <div className="eyebrow">{data.dateLabel}</div>
      <div className="screen-title-row">
        <h3 style={{ margin: 0 }}>{data.title}</h3>
        <div className="muted tabular" style={{ fontSize: 12.5 }}>
          {data.duration}
        </div>
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-3)', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div className="card-kicker" style={{ margin: 0 }}>
            Verdict
          </div>
          <span className="tag tag-accent" style={{ fontSize: 9.5, padding: '2px 7px' }}>
            {data.verdictTag}
          </span>
        </div>
        <div style={{ fontSize: 15, fontFamily: 'var(--font-heading)', lineHeight: 1.35 }}>{data.verdictHeadline}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px 14px' }}>
          {data.stats.map((m, i) => (
            <div key={i}>
              <div className="muted" style={{ fontSize: 10, letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                {m.label}
              </div>
              <div className="tabular" style={{ fontSize: 14.5, marginTop: 2, color: m.highlight ? 'var(--color-accent)' : undefined }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-3)', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div className="card-kicker" style={{ margin: 0 }}>
            Pace &amp; heart rate
          </div>
          <span className="muted" style={{ fontSize: 11 }}>
            {data.notesPinned} notes pinned
          </span>
        </div>
        <LineChart
          series={[
            { values: data.paceHr.pace, stroke: ACCENT },
            { values: data.paceHr.hr, stroke: NEUTRAL_LINE, dashed: true },
          ]}
          height={110}
          pinnedIndices={data.paceHr.pinnedIndices}
        />
        <div className="chart-legend">
          <span className="chart-legend-item">
            <span className="chart-legend-swatch" style={{ background: ACCENT }} />
            Pace
          </span>
          <span className="chart-legend-item">
            <span className="chart-legend-swatch" style={{ background: NEUTRAL_LINE }} />
            Heart rate
          </span>
        </div>
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-2)', marginBottom: 10 }}>
        <div className="card-kicker" style={{ margin: 0 }}>
          Timeline
        </div>
        <div className="timeline">
          <div className="timeline-rail" />
          <div className="timeline-items">
            {data.timeline.map((t, i) => (
              <div key={i}>
                <div className="timeline-row">
                  <span className="timeline-at">{t.at}</span>
                  <span className="timeline-label">{t.label}</span>
                  <span className="timeline-metric">{t.metric}</span>
                </div>
                {t.note && (
                  <div className="tc-note timeline-note">
                    <div className="tc-note-label">TC</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.55, marginTop: 3 }}>{t.note}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-2)' }}>
        <div className="card-kicker" style={{ margin: 0 }}>
          What this changes
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, lineHeight: 1.55 }}>
          {data.whatThisChanges.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
          <div className="tc-signoff">— TC</div>
        </div>
        <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontSize: 12 }} onClick={onAskTc}>
          Ask TC about this run
        </button>
      </div>
    </div>
  );
}
