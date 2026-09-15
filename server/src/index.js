import 'dotenv/config';
import express from 'express';
import { strava } from './strava.js';

const PORT = process.env.PORT || 8787;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REDIRECT_URI = process.env.STRAVA_REDIRECT_URI || `http://localhost:${PORT}/api/strava/callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn('[strava] STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET are not set. Copy server/.env.example to server/.env and fill them in.');
}

const app = express();
const creds = { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET };

// GET /api/strava/status — is Strava connected, and as whom?
app.get('/api/strava/status', async (_req, res) => {
  const tokens = strava.readTokens();
  if (!tokens?.accessToken) {
    return res.json({ connected: false });
  }
  res.json({
    connected: true,
    athlete: tokens.athlete
      ? { id: tokens.athlete.id, name: [tokens.athlete.firstname, tokens.athlete.lastname].filter(Boolean).join(' ') }
      : null,
  });
});

// GET /api/strava/connect — redirect the browser into Strava's OAuth consent screen
app.get('/api/strava/connect', (_req, res) => {
  if (!CLIENT_ID) return res.status(500).send('STRAVA_CLIENT_ID is not configured on the server.');
  res.redirect(strava.buildAuthorizeUrl({ clientId: CLIENT_ID, redirectUri: REDIRECT_URI }));
});

// GET /api/strava/callback — Strava redirects here after the athlete approves/denies
app.get('/api/strava/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    return res.redirect(`${APP_URL}/?strava=denied`);
  }
  try {
    await strava.exchangeCodeForTokens({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, code });
    res.redirect(`${APP_URL}/?strava=connected`);
  } catch (err) {
    console.error(err);
    res.redirect(`${APP_URL}/?strava=error`);
  }
});

// POST /api/strava/disconnect — revoke and forget local tokens
app.post('/api/strava/disconnect', async (_req, res) => {
  await strava.deauthorize(creds);
  res.json({ connected: false });
});

// GET /api/strava/test — proves the whole chain works: pulls the athlete profile
// and their most recent activities straight from the Strava API.
app.get('/api/strava/test', async (_req, res) => {
  try {
    const [athlete, activities] = await Promise.all([
      strava.callApi('/athlete', creds),
      strava.callApi('/athlete/activities', creds, { per_page: 5 }),
    ]);
    res.json({
      ok: true,
      athlete: { id: athlete.id, name: [athlete.firstname, athlete.lastname].filter(Boolean).join(' ') },
      recentActivities: activities.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        distanceMeters: a.distance,
        movingTimeSeconds: a.moving_time,
        startDate: a.start_date,
      })),
    });
  } catch (err) {
    if (err.code === 'NOT_CONNECTED') {
      return res.status(401).json({ ok: false, error: 'not_connected' });
    }
    console.error(err);
    res.status(502).json({ ok: false, error: 'strava_api_error', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[strava] server listening on http://localhost:${PORT}`);
  console.log(`[strava] connect flow:  http://localhost:${PORT}/api/strava/connect`);
});
