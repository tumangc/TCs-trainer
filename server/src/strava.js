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

export const strava = {
  readTokens,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  getValidAccessToken,
  deauthorize,
  callApi,
};
