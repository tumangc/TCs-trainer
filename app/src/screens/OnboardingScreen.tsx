import { useEffect, useState } from 'react';
import { useCoachService } from '../services/coachServiceContext';
import {
  CROSS_TRAIN_OPTIONS,
  GOAL_KIND_OPTIONS,
  OFF_DAY_OPTIONS,
  TIME_CAP_OPTIONS,
  type OnboardingData,
} from '../types/domain';

const PHASE_COLORS_PREVIEW = ['var(--color-accent)', '#5d5294', '#423a6a', '#3f424d'];

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const service = useCoachService();
  const [data, setData] = useState<OnboardingData | null>(null);
  const [step, setStep] = useState(1);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    service.getOnboarding().then(setData);
  }, [service]);

  if (!data) return <div className="screen-loading muted">Loading onboarding…</div>;

  const setGoalKind = (kind: (typeof GOAL_KIND_OPTIONS)[number]) => {
    service.setOnboardingGoalKind(kind).then((goal) => setData((d) => (d ? { ...d, goal } : d)));
  };
  const updateGoalField = (patch: Partial<Pick<OnboardingData['goal'], 'race' | 'date' | 'goalTime'>>) => {
    setData((d) => (d ? { ...d, goal: { ...d.goal, ...patch } } : d));
    service.updateOnboardingGoal(patch);
  };
  const toggleOffDay = (day: string) => {
    const offDays = data.constraints.offDays.includes(day)
      ? data.constraints.offDays.filter((d) => d !== day)
      : [...data.constraints.offDays, day];
    service.updateOnboardingConstraints({ offDays }).then((constraints) => setData((d) => (d ? { ...d, constraints } : d)));
  };
  const setTimeCap = (timeCap: string) => {
    service.updateOnboardingConstraints({ timeCap }).then((constraints) => setData((d) => (d ? { ...d, constraints } : d)));
  };
  const toggleCross = (opt: string) => {
    const cross = data.constraints.cross.includes(opt) ? data.constraints.cross.filter((c) => c !== opt) : [...data.constraints.cross, opt];
    service.updateOnboardingConstraints({ cross }).then((constraints) => setData((d) => (d ? { ...d, constraints } : d)));
  };
  const setRecurring = (recurring: string) => {
    setData((d) => (d ? { ...d, constraints: { ...d.constraints, recurring } } : d));
    service.updateOnboardingConstraints({ recurring });
  };
  const updateFitnessField = (patch: Partial<Pick<OnboardingData['fitness'], 'recentRaceDist' | 'recentRaceTime' | 'weeklyKm' | 'yearsRunning'>>) => {
    setData((d) => (d ? { ...d, fitness: { ...d.fitness, ...patch } } : d));
    service.updateOnboardingFitness(patch);
  };
  const importFromWatch = () => {
    setImporting(true);
    service.importFitnessFromWatch().then((fitness) => {
      setImporting(false);
      setData((d) => (d ? { ...d, fitness } : d));
    });
  };
  const next = () => {
    if (step === 4) {
      service.completeOnboarding().then(onComplete);
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="onboarding-dots">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={`onboarding-dot${n <= step ? ' onboarding-dot--done' : ''}`} />
          ))}
        </div>
        <div className="muted" style={{ fontSize: 11 }}>
          Step {step} of 4
        </div>
      </div>

      {step === 1 && (
        <div className="tc-rise">
          <div className="eyebrow">Step one</div>
          <h3 style={{ margin: '5px 0 6px' }}>What are you training for?</h3>
          <p className="muted-70" style={{ fontSize: 12.5, lineHeight: 1.55, margin: '0 0 14px' }}>
            Everything I prescribe works backwards from this date. You can change it later and I will rebuild the block.
          </p>

          <div className="seg" style={{ width: '100%', marginBottom: 12 }}>
            {GOAL_KIND_OPTIONS.map((label) => (
              <button
                key={label}
                type="button"
                className="seg-opt"
                style={{ flex: 1, padding: '8px 6px', fontSize: 11.5, background: 'transparent', border: 0, fontFamily: 'inherit' }}
                aria-pressed={data.goal.kind === label}
                onClick={() => setGoalKind(label)}
              >
                <span style={{ color: data.goal.kind === label ? 'var(--color-accent)' : undefined }}>{label}</span>
              </button>
            ))}
          </div>

          <div className="card elev-sm" style={{ gap: 'var(--space-3)' }}>
            <div className="field">
              <label htmlFor="tc-race">Race</label>
              <input className="input" id="tc-race" value={data.goal.race} onChange={(e) => updateGoalField({ race: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="tc-date">Date</label>
                <input className="input" id="tc-date" value={data.goal.date} onChange={(e) => updateGoalField({ date: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="tc-goal">Goal time</label>
                <input className="input" id="tc-goal" value={data.goal.goalTime} onChange={(e) => updateGoalField({ goalTime: e.target.value })} />
              </div>
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'color-mix(in srgb,var(--color-text) 78%,transparent)', borderTop: '1px solid var(--color-divider)', paddingTop: 9 }}>
              {data.goal.note}
              <div className="tc-signoff">— TC</div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="tc-rise">
          <div className="eyebrow">Step two</div>
          <h3 style={{ margin: '5px 0 6px' }}>When can you actually run?</h3>
          <p className="muted-70" style={{ fontSize: 12.5, lineHeight: 1.55, margin: '0 0 14px' }}>
            I would rather plan around your real week than reschedule every session you miss.
          </p>

          <div className="card elev-sm" style={{ gap: 'var(--space-4)' }}>
            <div>
              <div className="muted" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                Days you can't run
              </div>
              <div className="chip-row">
                {OFF_DAY_OPTIONS.map((day) => (
                  <button key={day} type="button" className="chip" aria-pressed={data.constraints.offDays.includes(day)} onClick={() => toggleOffDay(day)}>
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                Most time on a weekday
              </div>
              <div className="seg" style={{ width: '100%' }}>
                {TIME_CAP_OPTIONS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="seg-opt"
                    style={{ flex: 1, padding: '7px 4px', fontSize: 11.5, background: 'transparent', border: 0, fontFamily: 'inherit' }}
                    aria-pressed={data.constraints.timeCap === label}
                    onClick={() => setTimeCap(label)}
                  >
                    <span style={{ color: data.constraints.timeCap === label ? 'var(--color-accent)' : undefined }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                Cross-training I should count
              </div>
              <div className="chip-row">
                {CROSS_TRAIN_OPTIONS.map((opt) => (
                  <button key={opt} type="button" className="chip" aria-pressed={data.constraints.cross.includes(opt)} onClick={() => toggleCross(opt)}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="tc-commit">Anything recurring</label>
              <input className="input" id="tc-commit" value={data.constraints.recurring} onChange={(e) => setRecurring(e.target.value)} />
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'color-mix(in srgb,var(--color-text) 78%,transparent)', borderTop: '1px solid var(--color-divider)', paddingTop: 9 }}>
              {data.constraints.note}
              <div className="tc-signoff">— TC</div>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="tc-rise">
          <div className="eyebrow">Step three</div>
          <h3 style={{ margin: '5px 0 6px' }}>Where are you starting from?</h3>
          <p className="muted-70" style={{ fontSize: 12.5, lineHeight: 1.55, margin: '0 0 14px' }}>
            One honest recent result beats a questionnaire. I will keep revising this from your runs either way.
          </p>

          <div className="card elev-sm" style={{ gap: 'var(--space-3)', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="tc-dist">Recent race</label>
                <input className="input" id="tc-dist" value={data.fitness.recentRaceDist} onChange={(e) => updateFitnessField({ recentRaceDist: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="tc-time">Time</label>
                <input className="input" id="tc-time" value={data.fitness.recentRaceTime} onChange={(e) => updateFitnessField({ recentRaceTime: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="tc-vol">Weekly km now</label>
                <input className="input" id="tc-vol" value={data.fitness.weeklyKm} onChange={(e) => updateFitnessField({ weeklyKm: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="tc-yrs">Years running</label>
                <input className="input" id="tc-yrs" value={data.fitness.yearsRunning} onChange={(e) => updateFitnessField({ yearsRunning: e.target.value })} />
              </div>
            </div>
            <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontSize: 12 }} onClick={importFromWatch} disabled={importing}>
              {importing ? 'Importing…' : 'Import 18 months from my watch instead'}
            </button>
          </div>

          <div className="card elev-sm" style={{ gap: 'var(--space-2)' }}>
            <div className="card-kicker" style={{ margin: 0 }}>
              What I take from that
            </div>
            {data.fitness.reads.map((f, i) => (
              <div key={i} className="row-rule" style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: 12.5 }}>
                <span className="muted-70" style={{ flex: 1 }}>
                  {f.label}
                </span>
                <span className="tabular">{f.value}</span>
                <span style={{ fontSize: 11, color: 'var(--color-accent-300)', width: 58, textAlign: 'right' }}>{f.confidence}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="tc-rise">
          <div className="eyebrow">Step four</div>
          <h3 style={{ margin: '5px 0 6px' }}>Here is the block I would run</h3>
          <p className="muted-70" style={{ fontSize: 12.5, lineHeight: 1.55, margin: '0 0 14px' }}>
            14 weeks, 4 runs a week, Tuesday kept for your club session. Nothing here is fixed — I rewrite it as I learn.
          </p>

          <div className="card elev-sm" style={{ gap: 'var(--space-3)', marginBottom: 10 }}>
            <div className="phase-bar">
              {data.preview.phases.map((p, i) => (
                <div key={i} className="phase-bar-seg" style={{ flex: p.fraction, background: PHASE_COLORS_PREVIEW[i] }} />
              ))}
            </div>
            <div className="phase-labels">
              {data.preview.phases.map((p, i) => (
                <span key={i}>
                  {p.label} {p.weeks}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {data.preview.week.map((p, i) => (
                <div key={i} className="row-rule" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 0', fontSize: 12.5 }}>
                  <span className="muted" style={{ width: 26, fontSize: 11 }}>
                    {p.day}
                  </span>
                  <span style={{ width: 3, height: 20, borderRadius: 2, background: p.highlighted ? 'var(--color-accent)' : 'var(--color-neutral-800)', flex: 'none' }} />
                  <span style={{ flex: 1 }}>{p.title}</span>
                  <span className="muted tabular" style={{ fontSize: 11.5 }}>
                    {p.meta}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card elev-sm" style={{ gap: 'var(--space-2)', marginBottom: 12 }}>
            <div className="card-kicker" style={{ margin: 0 }}>
              Where I'm guessing
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12.5, lineHeight: 1.55, color: 'color-mix(in srgb,var(--color-text) 82%,transparent)' }}>
              {data.preview.guesses.map((g, i) => (
                <div key={i}>{g}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="onboarding-footer">
        {step > 1 && (
          <button type="button" className="btn btn-secondary" onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={next}>
          {step === 4 ? 'Start this plan' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
