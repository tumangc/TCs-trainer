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

export const strava = {
  readTokens,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  getValidAccessToken,
  deauthorize,
  callApi,
  summarizeRunningFitness,
  computeFitnessFromActivities,
};
