import { useEffect, useState } from 'react';
import { useCoachService } from '../services/coachServiceContext';
import { disconnectStrava, getStravaStatus, stravaConnectUrl, testStravaConnection, type StravaStatus, type StravaTestResult } from '../services/stravaClient';
import type { ProfileData } from '../types/domain';

const ZONE_COLORS = ['#3f424d', '#423a6a', '#5d5294', '#9184d9', '#d2cefd'];

export function ProfileScreen({ isFull, onOpenModel, onOpenNotifs }: { isFull: boolean; onOpenModel: () => void; onOpenNotifs: () => void }) {
  const service = useCoachService();
  const [data, setData] = useState<ProfileData | null>(null);
  const [strava, setStrava] = useState<StravaStatus>({ connected: false });
  const [stravaTest, setStravaTest] = useState<StravaTestResult | null>(null);
  const [stravaBusy, setStravaBusy] = useState(false);

  useEffect(() => {
    service.getProfile().then(setData);
  }, [service]);

  useEffect(() => {
    getStravaStatus().then(setStrava);

    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('strava');
    if (outcome) {
      window.history.replaceState(null, '', window.location.pathname);
      if (outcome === 'connected') getStravaStatus().then(setStrava);
    }
  }, []);

  async function handleStravaDisconnect() {
    setStravaBusy(true);
    setStravaTest(null);
    await disconnectStrava();
    setStrava({ connected: false });
    setStravaBusy(false);
  }

  async function handleStravaTest() {
    setStravaBusy(true);
    const result = await testStravaConnection();
    setStravaTest(result);
    setStravaBusy(false);
  }

  if (!data) return <div className="screen-loading muted">Loading profile…</div>;

  const prefs = data.prefs.map((p) => (p.label === 'Default detail' ? { ...p, value: isFull ? 'Full' : 'Simple' } : p));

  return (
    <div>
      <div className="eyebrow">Profile</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 16px' }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: '50%',
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-heading)',
            fontSize: 16,
            color: 'var(--color-accent-300)',
            background: 'var(--color-accent-800)',
            boxShadow: '0 0 0 1px var(--color-accent-700)',
          }}
        >
          {data.initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0 }}>{data.name}</h3>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {data.raceSummary}
          </div>
        </div>
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-3)', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div className="card-kicker" style={{ margin: 0 }}>
            Zones &amp; thresholds
          </div>
          <span className="muted" style={{ fontSize: 11 }}>
            TC set these · {data.setDate}
          </span>
        </div>
        <div>
          {data.thresholds.map((t, i) => (
            <div key={i} className="row-rule" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', fontSize: 12.5 }}>
              <span className="muted-70">{t.label}</span>
              <span style={{ display: 'flex', gap: 9, alignItems: 'baseline' }}>
                <span className="tabular">{t.value}</span>
                <span style={{ fontSize: 11, color: 'var(--color-accent-300)', width: 64, textAlign: 'right', whiteSpace: 'nowrap' }}>{t.source}</span>
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {data.zoneBar.map((flex, i) => (
            <div
              key={i}
              style={{
                flex,
                height: 6,
                background: ZONE_COLORS[i],
                borderRadius: i === 0 ? '3px 0 0 3px' : i === data.zoneBar.length - 1 ? '0 3px 3px 0' : 0,
              }}
            />
          ))}
        </div>
        <div className="muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          <span>Z1</span>
          <span>Z2</span>
          <span>Z3</span>
          <span>Z4</span>
          <span>Z5</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onOpenModel}>
            Why these numbers
          </button>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }}>
            Override
          </button>
        </div>
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-2)', marginBottom: 10 }}>
        <div className="card-kicker" style={{ margin: 0 }}>
          Devices
        </div>
        {data.devices.map((d, i) => {
          const isStrava = d.name === 'Strava';
          const connected = isStrava ? strava.connected : d.connected;
          const state = isStrava
            ? strava.connected
              ? strava.athlete?.name
                ? `Connected as ${strava.athlete.name}`
                : 'Connected'
              : 'Not connected'
            : d.state;

          return (
            <div key={i} className="row-rule" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? 'var(--color-accent)' : 'var(--color-neutral-800)', flex: 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13 }}>{d.name}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                  {state}
                </div>
              </div>
              {isStrava ? (
                <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
                  {strava.connected ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: 11.5, color: 'var(--color-accent-300)', padding: 0 }}
                        disabled={stravaBusy}
                        onClick={handleStravaTest}
                      >
                        Test
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: 11.5, color: 'var(--color-accent-300)', padding: 0 }}
                        disabled={stravaBusy}
                        onClick={handleStravaDisconnect}
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <a href={stravaConnectUrl()} style={{ fontSize: 11.5, color: 'var(--color-accent-300)' }}>
                      Connect
                    </a>
                  )}
                </div>
              ) : (
                <span style={{ fontSize: 11.5, color: 'var(--color-accent-300)' }}>{d.action}</span>
              )}
            </div>
          );
        })}
        {stravaTest && (
          <div
            className="muted"
            style={{ fontSize: 11.5, lineHeight: 1.5, background: 'var(--color-accent-800)', borderRadius: 8, padding: '8px 10px' }}
          >
            {stravaTest.ok ? (
              <>
                Strava data access verified — reading as <strong>{stravaTest.athlete?.name}</strong>,{' '}
                {stravaTest.recentActivities?.length ?? 0} recent activities pulled
                {stravaTest.recentActivities?.[0] ? ` (latest: "${stravaTest.recentActivities[0].name}")` : ''}.
              </>
            ) : (
              <>Strava test failed: {stravaTest.error === 'not_connected' ? 'not connected.' : stravaTest.message || stravaTest.error}</>
            )}
          </div>
        )}
        <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
          TC reads whatever you connect and works without any of it — the watch records, the app decides.
        </div>
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-2)', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div className="card-kicker" style={{ margin: 0 }}>
            Constraints
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--color-accent-300)' }}>Edit</span>
        </div>
        {data.constraints.map((c, i) => (
          <div key={i} className="row-rule" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 12.5 }}>
            <span className="muted-70">{c.label}</span>
            <span style={{ textAlign: 'right' }}>{c.value}</span>
          </div>
        ))}
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-2)', marginBottom: 10 }}>
        <div className="card-kicker" style={{ margin: 0 }}>
          Race calendar
        </div>
        {data.races.map((r, i) => (
          <div key={i} className="row-rule" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
            <span
              className="tag"
              style={{
                fontSize: 9.5,
                padding: '2px 6px',
                background: r.grade === 'A' ? 'var(--color-accent-800)' : 'transparent',
                color: r.grade === 'A' ? 'var(--color-accent-300)' : 'color-mix(in srgb,var(--color-text) 66%,transparent)',
                boxShadow: r.grade === 'A' ? '0 0 0 1px var(--color-accent)' : '0 0 0 1px var(--color-divider)',
              }}
            >
              {r.grade}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13 }}>{r.name}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                {r.role}
              </div>
            </div>
            <span className="muted tabular" style={{ fontSize: 11.5 }}>
              {r.date}
            </span>
          </div>
        ))}
        <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontSize: 12 }}>
          Add a race
        </button>
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-2)', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div className="card-kicker" style={{ margin: 0 }}>
            TC's learning log
          </div>
          <span className="muted" style={{ fontSize: 11 }}>
            {data.learnLogTotal}
          </span>
        </div>
        {data.learnLog.map((l, i) => (
          <div key={i} className="row-rule" style={{ display: 'flex', gap: 10, padding: '6px 0', fontSize: 12.5 }}>
            <span style={{ width: 44, flex: 'none', fontSize: 11, color: 'var(--color-accent-300)' }}>{l.date}</span>
            <span style={{ flex: 1, lineHeight: 1.45 }}>{l.what}</span>
          </div>
        ))}
        <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontSize: 12 }} onClick={onOpenModel}>
          See the full model
        </button>
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-2)', marginBottom: 10 }}>
        <div className="card-kicker" style={{ margin: 0 }}>
          Preferences
        </div>
        {prefs.map((p, i) => (
          <div key={i} className="row-rule" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5 }}>
            <span className="muted-70">{p.label}</span>
            <span>{p.value}</span>
          </div>
        ))}
        <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontSize: 12 }} onClick={onOpenNotifs}>
          Notifications
        </button>
      </div>

      <div className="card elev-sm" style={{ gap: 'var(--space-2)' }}>
        <div className="card-kicker" style={{ margin: 0 }}>
          Your data
        </div>
        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'color-mix(in srgb,var(--color-text) 78%,transparent)' }}>{data.dataNote}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }}>
            Export everything
          </button>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12, color: '#d2cefd' }}>
            Delete account
          </button>
        </div>
      </div>
    </div>
  );
}
