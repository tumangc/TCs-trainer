import { useEffect, useState } from 'react';
import { useCoachService } from '../services/coachServiceContext';
import type { ModelData } from '../types/domain';

export function ModelScreen() {
  const service = useCoachService();
  const [data, setData] = useState<ModelData | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    service.getModel().then(setData);
  }, [service]);

  if (!data) return <div className="screen-loading muted">Loading TC's model of you…</div>;

  return (
    <div>
      <div className="eyebrow">Transparency</div>
      <h3 style={{ margin: '5px 0 6px' }}>What TC believes</h3>
      <p className="muted-70" style={{ fontSize: 12.5, lineHeight: 1.55, margin: '0 0 14px' }}>
        {data.intro}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.beliefs.map((b) => {
          const open = openId === b.id;
          return (
            <div key={b.id} className="card elev-sm" style={{ gap: 'var(--space-2)' }}>
              <button
                type="button"
                style={{ background: 'transparent', border: 0, padding: 0, textAlign: 'left', fontFamily: 'inherit', color: 'inherit', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start' }}
                onClick={() => setOpenId(open ? null : b.id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, lineHeight: 1.4 }}>{b.claim}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                    <span className="tag tag-neutral" style={{ fontSize: 9.5, padding: '2px 7px' }}>
                      {b.confidence}
                    </span>
                    <span className="muted" style={{ fontSize: 11 }}>
                      {b.revisedLabel}
                    </span>
                  </div>
                </div>
                <div style={{ color: 'var(--color-accent)', fontSize: 13, lineHeight: 1.4 }}>{open ? '⌃' : '⌄'}</div>
              </button>
              {open && (
                <div className="tc-rise" style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 10, display: 'flex', gap: 11 }}>
                  <div style={{ width: 1, background: 'linear-gradient(to bottom,var(--color-accent),color-mix(in srgb,var(--color-accent) 18%,transparent))', flex: 'none', margin: '4px 0' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11 }}>
                    {b.history.map((h, i) => (
                      <div key={i}>
                        <div style={{ fontSize: 10, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--color-accent-300)' }}>{h.date}</div>
                        <div style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 3 }}>{h.what}</div>
                        <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 3 }}>
                          {h.why}
                        </div>
                      </div>
                    ))}
                    <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontSize: 12 }}>
                      This is wrong
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
