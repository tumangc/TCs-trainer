import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_PATH = path.join(__dirname, '..', 'data', 'strava-tokens.json');

const AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
const TOKEN_URL = 'https://www.strava.com/oauth/token';
const DEAUTHORIZE_URL = 'https://www.strava.com/oauth/deauthorize';
const API_BASE = 'https://www.strava.com/api/v3';

function readTokens() {
  if (!existsSync(TOKENS_PATH)) return null;
  try {
    return JSON.parse(readFileSync(TOKENS_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function writeTokens(tokens) {
  writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

function clearTokens() {
  if (existsSync(TOKENS_PATH)) writeFileSync(TOKENS_PATH, JSON.stringify(null));
}

function buildAuthorizeUrl({ clientId, redirectUri }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens({ clientId, clientSecret, code }) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const tokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    athlete: data.athlete ?? null,
  };
  writeTokens(tokens);
  return tokens;
}

async function refreshTokens({ clientId, clientSecret, refreshToken }) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    throw new Error(`Strava token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const existing = readTokens() ?? {};
  const tokens = {
    ...existing,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
  };
  writeTokens(tokens);
  return tokens;
}

async function getValidAccessToken({ clientId, clientSecret }) {
  const tokens = readTokens();
  if (!tokens?.accessToken) return null;

  const isExpired = tokens.expiresAt && tokens.expiresAt * 1000 < Date.now() + 60_000;
  if (!isExpired) return tokens.accessToken;

  const refreshed = await refreshTokens({ clientId, clientSecret, refreshToken: tokens.refreshToken });
  return refreshed.accessToken;
}

async function deauthorize({ clientId, clientSecret }) {
  const accessToken = await getValidAccessToken({ clientId, clientSecret });
  if (accessToken) {
    await fetch(DEAUTHORIZE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {});
  }
  clearTokens();
}

async function callApi(pathname, { clientId, clientSecret }, searchParams) {
  const accessToken = await getValidAccessToken({ clientId, clientSecret });
  if (!accessToken) {
    const err = new Error('Not connected to Strava');
    err.code = 'NOT_CONNECTED';
    throw err;
  }
  const qs = searchParams ? `?${new URLSearchParams(searchParams).toString()}` : '';
  const res = await fetch(`${API_BASE}${pathname}${qs}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Strava API ${pathname} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

// Pure, network-free — takes raw Strava activities and derives the same
// shape the onboarding "fitness" step needs. Exported separately so it can
// be unit tested without hitting the real API.
function summarizeRunningFitness(activities) {
  const runs = activities.filter((a) => a.type === 'Run' || a.sport_type === 'Run');
  if (runs.length === 0) {
    return { recentRaceDist: 'No runs found', recentRaceTime: '—', weeklyKm: '0', yearsRunning: '0' };
  }

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 3600 * 1000;
  const weeklyMeters = runs
    .filter((a) => new Date(a.start_date).getTime() >= weekAgo)
    .reduce((sum, a) => sum + (a.distance || 0), 0);

  const longest = runs.reduce((best, a) => (a.distance > (best?.distance ?? 0) ? a : best), runs[0]);

  const oldestStart = runs.reduce((min, a) => Math.min(min, new Date(a.start_date).getTime()), now);
  const yearsSpan = Math.max(1, Math.round((now - oldestStart) / (365.25 * 24 * 3600 * 1000)));
  const hitPageLimit = activities.length >= 100;

  return {
    recentRaceDist: `${(longest.distance / 1000).toFixed(1)} km`,
    recentRaceTime: formatDuration(longest.moving_time),
    weeklyKm: String(Math.round(weeklyMeters / 1000)),
    yearsRunning: hitPageLimit ? `${yearsSpan}+` : String(yearsSpan),
  };
}

async function computeFitnessFromActivities(creds) {
  const activities = await callApi('/athlete/activities', creds, { per_page: 100 });
  return summarizeRunningFitness(activities);
}

function paceStringFromSpeed(metersPerSecond) {
  const totalSeconds = Math.round(1000 / metersPerSecond);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

// Pure, network-free — derives real training beliefs from raw Strava
// activities instead of the mock's hardcoded set. Only claims what the data
// actually supports: Strava's `workout_type` tags (0 default, 1 race, 2 long
// run, 3 workout) distinguish easy runs from hard efforts, so pace-based
// claims lean on that rather than guessing from pace alone. Things Strava
// summaries don't expose (HRV, sleep, true lactate threshold) are left out
// rather than faked.
function computeBeliefsFromActivities(activities, now = Date.now()) {
  const runs = activities.filter((a) => a.type === 'Run' || a.sport_type === 'Run');
  const beliefs = [];

  let maxHr = null;
  for (const r of runs) {
    if (typeof r.max_heartrate === 'number') maxHr = maxHr === null ? r.max_heartrate : Math.max(maxHr, r.max_heartrate);
  }

  const hardEfforts = runs.filter((r) => (r.workout_type === 1 || r.workout_type === 3) && r.moving_time >= 600 && r.average_speed > 0);
  let thresholdSpeed = null;
  if (hardEfforts.length > 0) {
    const best = hardEfforts.reduce((a, b) => (b.average_speed > a.average_speed ? b : a));
    thresholdSpeed = best.average_speed;
    const paceStr = paceStringFromSpeed(best.average_speed);
    beliefs.push({
      id: 'strava-threshold-pace',
      claim: `Your threshold sits around ${paceStr}, from your fastest tagged workout or race.`,
      confidence: hardEfforts.length >= 3 ? 'Medium confidence' : 'Low confidence — few tagged workouts',
      revisedLabel: `From Strava · ${hardEfforts.length} tagged effort${hardEfforts.length === 1 ? '' : 's'}`,
      history: [
        {
          date: (best.start_date || '').slice(0, 10),
          what: `"${best.name}" held ${paceStr} for ${Math.round(best.moving_time / 60)} min.`,
          why: 'Your fastest pace in a run tagged Workout or Race on Strava — the closest proxy to threshold I can read from activity summaries alone.',
        },
      ],
    });
  } else {
    beliefs.push({
      id: 'strava-threshold-pace',
      claim: "I can't estimate your threshold pace from Strava yet.",
      confidence: 'Low confidence — needs your input',
      revisedLabel: 'No tagged workouts or races found',
      history: [
        {
          date: new Date(now).toISOString().slice(0, 10),
          what: 'No runs tagged Workout or Race in your recent Strava history.',
          why: 'Tag a hard session as Workout or Race in Strava and I will pick it up next sync.',
        },
      ],
    });
  }

  const weekMs = 7 * 24 * 3600 * 1000;
  const weeklyKm = [];
  for (let i = 0; i < 8; i++) {
    const start = now - (i + 1) * weekMs;
    const end = now - i * weekMs;
    const meters = runs
      .filter((r) => {
        const t = new Date(r.start_date).getTime();
        return t >= start && t < end;
      })
      .reduce((sum, r) => sum + (r.distance || 0), 0);
    weeklyKm.push(Math.round(meters / 1000));
  }
  const activeWeeks = weeklyKm.filter((k) => k > 0).length;
  const [currentWeek, previousWeek] = weeklyKm;
  let rampClaim;
  if (previousWeek > 0) {
    const pct = Math.round(((currentWeek - previousWeek) / previousWeek) * 100);
    rampClaim =
      pct === 0
        ? `You're holding steady at about ${currentWeek} km this week, level with last week.`
        : `You're at about ${currentWeek} km this week, ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct)}% on last week's ${previousWeek} km.`;
  } else {
    rampClaim = `You're at about ${currentWeek} km this week.`;
  }
  beliefs.push({
    id: 'strava-weekly-load',
    claim: rampClaim,
    confidence: activeWeeks >= 4 ? 'Medium confidence' : 'Low confidence — short history',
    revisedLabel: `From Strava · last ${activeWeeks} active week${activeWeeks === 1 ? '' : 's'}`,
    history: weeklyKm
      .map((km, i) => ({ km, i }))
      .filter((w) => w.km > 0)
      .slice(0, 4)
      .map(({ km, i }) => ({
        date: i === 0 ? 'This week' : `${i} week${i === 1 ? '' : 's'} ago`,
        what: `${km} km logged.`,
        why: 'Summed from your Strava run distances for that week.',
      })),
  });

  const easyRuns = runs.filter((r) => (r.workout_type === 0 || r.workout_type == null) && r.average_speed > 0);
  if (thresholdSpeed && easyRuns.length >= 3) {
    const avgEasySpeed = easyRuns.reduce((sum, r) => sum + r.average_speed, 0) / easyRuns.length;
    const gapPct = Math.round(((thresholdSpeed - avgEasySpeed) / thresholdSpeed) * 100);
    const easyPaceStr = paceStringFromSpeed(avgEasySpeed);
    const tooHot = gapPct < 12;
    beliefs.push({
      id: 'strava-easy-day-effort',
      claim: tooHot
        ? `Your easy runs average ${easyPaceStr}, only about ${gapPct}% slower than your threshold pace — you may be running easy days too hard.`
        : `Your easy runs average ${easyPaceStr}, about ${gapPct}% slower than your threshold pace — that's a healthy gap.`,
      confidence: easyRuns.length >= 8 ? 'Medium confidence' : 'Low confidence — small sample',
      revisedLabel: `From Strava · ${easyRuns.length} easy runs`,
      history: [
        {
          date: new Date(now).toISOString().slice(0, 10),
          what: `Average pace across your last ${easyRuns.length} untagged runs: ${easyPaceStr}.`,
          why: 'Compared against your Strava-derived threshold estimate above.',
        },
      ],
    });
  }

  return { beliefs, thresholdPace: thresholdSpeed ? paceStringFromSpeed(thresholdSpeed) : null, maxHr };
}

async function computeInsightsFromActivities(creds) {
  const activities = await callApi('/athlete/activities', creds, { per_page: 100 });
  return computeBeliefsFromActivities(activities);
}

export const strava = {
  readTokens,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  getValidAccessToken,
  deauthorize,
  callApi,
  summarizeRunningFitness,
  computeFitnessFromActivities,
  computeBeliefsFromActivities,
  computeInsightsFromActivities,
};
