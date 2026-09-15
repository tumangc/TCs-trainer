import { useEffect, useState } from 'react';
import { useCoachService } from '../services/coachServiceContext';
import type { NotificationsData } from '../types/domain';

export function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const service = useCoachService();
  const [data, setData] = useState<NotificationsData | null>(null);

  useEffect(() => {
    service.getNotifications().then(setData);
  }, [service]);

  if (!data) return <div className="screen-loading muted">Loading notifications…</div>;

  const toggle = (label: string, on: boolean) => {
    setData((d) => (d ? { ...d, toggles: d.toggles.map((t) => (t.label === label ? { ...t, on: !on } : t)) } : d));
    service.setNotificationToggle(label, !on);
  };

  return (
    <div>
      <button type="button" className="btn btn-ghost" style={{ padding: '2px 0', fontSize: 12, marginBottom: 10 }} onClick={onBack}>
        ‹ Profile
      </button>
      <div className="eyebrow">Notifications</div>
      <h3 style={{ margin: '5px 0 6px' }}>What TC sends you</h3>
      <p className="muted-70" style={{ fontSize: 12.5, lineHeight: 1.55, margin: '0 0 14px' }}>
        {data.intro}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {data.previews.map((n, i) => (
          <div
            key={i}
            style={{
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              background: 'color-mix(in srgb,#e9e9ed 9%,transparent)',
              boxShadow: '0 0 0 1px color-mix(in srgb,#e9e9ed 10%,transparent)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--color-accent-800)', boxShadow: '0 0 0 1px var(--color-accent-700)', flex: 'none' }} />
              <span className="muted" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', flex: 1 }}>
                TCs Trainer · {n.kind}
              </span>
              <span className="tabular" style={{ fontSize: 10.5, color: 'color-mix(in srgb,var(--color-text) 60%,transparent)' }}>
                {n.at}
              </span>
            </div>
            <div style={{ fontSize: 13, marginTop: 7 }}>{n.title}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 3, color: 'color-mix(in srgb,var(--color-text) 76%,transparent)' }}>{n.body}</div>
          </div>
        ))}
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-2)', marginBottom: 10 }}>
        <div className="card-kicker" style={{ margin: 0 }}>
          Send me
        </div>
        {data.toggles.map((t) => (
          <div key={t.label} className="row-rule" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13 }}>{t.label}</div>
              <div className="muted" style={{ fontSize: 11, lineHeight: 1.45, marginTop: 2 }}>
                {t.note}
              </div>
            </div>
            <button
              type="button"
              style={{
                width: 38,
                height: 22,
                borderRadius: 11,
                border: 0,
                flex: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                background: t.on ? 'var(--color-accent-700)' : 'color-mix(in srgb,#e9e9ed 10%,transparent)',
                boxShadow: t.on ? '0 0 0 1px var(--color-accent)' : '0 0 0 1px var(--color-divider)',
                justifyContent: t.on ? 'flex-end' : 'flex-start',
              }}
              onClick={() => toggle(t.label, t.on)}
              aria-pressed={t.on}
            >
              <span style={{ width: 16, height: 16, borderRadius: '50%', margin: '0 3px', background: t.on ? '#d2cefd' : 'color-mix(in srgb,var(--color-text) 66%,transparent)', display: 'block' }} />
            </button>
          </div>
        ))}
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-2)' }}>
        <div className="card-kicker" style={{ margin: 0 }}>
          Timing
        </div>
        {data.timing.map((t, i) => (
          <div key={i} className="row-rule" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5 }}>
            <span className="muted-70">{t.label}</span>
            <span className="tabular">{t.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
