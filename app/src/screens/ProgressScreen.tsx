import { useEffect, useState } from 'react';
import { useCoachService } from '../services/coachServiceContext';
import type { ProgressData } from '../types/domain';
import { BarChart, LineChart } from '../components/shared/Charts';

const ACCENT = '#9184d9';
const NEUTRAL_LINE = '#b2b6ca';

export function ProgressScreen() {
  const service = useCoachService();
  const [data, setData] = useState<ProgressData | null>(null);

  useEffect(() => {
    service.getProgress().then(setData);
  }, [service]);

  if (!data) return <div className="screen-loading muted">Loading progress…</div>;

  return (
    <div>
      <div className="eyebrow">{data.sinceLabel}</div>
      <h3 style={{ margin: '5px 0 16px' }}>Progress</h3>

      <div className="card elev-sm" style={{ gap: 'var(--space-3)', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div className="card-kicker" style={{ margin: 0 }}>
            Load &amp; form
          </div>
          <div className="tabular muted-70" style={{ fontSize: 11.5 }}>
            CTL {data.loadForm.ctl} · ATL {data.loadForm.atl} · TSB +{data.loadForm.tsb}
          </div>
        </div>
        <LineChart
          series={[
            { values: data.loadForm.fitness, stroke: ACCENT, fill: true },
            { values: data.loadForm.fatigue, stroke: NEUTRAL_LINE, dashed: true },
          ]}
          height={120}
        />
        <div className="chart-legend">
          <span className="chart-legend-item">
            <span className="chart-legend-swatch" style={{ background: ACCENT }} />
            Fitness
          </span>
          <span className="chart-legend-item">
            <span className="chart-legend-swatch" style={{ background: NEUTRAL_LINE }} />
            Fatigue
          </span>
        </div>
        <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 9, fontSize: 12.5, lineHeight: 1.55, color: 'color-mix(in srgb,var(--color-text) 82%,transparent)' }}>
          {data.loadForm.note} — TC
        </div>
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-3)', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div className="card-kicker" style={{ margin: 0 }}>
            Predicted half
          </div>
          <div className="tabular" style={{ fontSize: 11.5, color: 'var(--color-accent-300)' }}>
            {data.racePrediction.current} · goal {data.racePrediction.goal}
          </div>
        </div>
        <LineChart series={[{ values: data.racePrediction.series, stroke: ACCENT }]} height={96} goalLine={data.racePrediction.goalLine} />
        <div className="muted-70" style={{ fontSize: 12 }}>
          {data.racePrediction.crossedWeekLabel}. {data.racePrediction.note}
        </div>
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-3)', marginBottom: 10 }}>
        <div className="card-kicker" style={{ margin: 0 }}>
          Weekly volume
        </div>
        <BarChart values={data.weeklyVolume.series} highlightIndex={data.weeklyVolume.series.length - 1} height={78} />
        <div className="muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
          <span>{data.weeklyVolume.sinceLabel}</span>
          <span>{data.weeklyVolume.currentLabel}</span>
        </div>
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-2)' }}>
        <div className="card-kicker" style={{ margin: 0 }}>
          Bests this block
        </div>
        {data.bests.map((b, i) => (
          <div key={i} className="row-rule" style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '7px 0' }}>
            <div className="muted" style={{ width: 52, fontSize: 12 }}>
              {b.distance}
            </div>
            <div className="tabular" style={{ flex: 1, fontSize: 15 }}>
              {b.time}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--color-accent-300)' }}>{b.delta}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
