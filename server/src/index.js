import 'dotenv/config';
import express from 'express';
import { amendPrescription, chatWithCoach } from './coach.js';
import { buildPlan, buildToday } from './planAssembler.js';
import { strava } from './strava.js';
import { getUser, resetUser, updateUser } from './userStore.js';

const PORT = process.env.PORT || 8787;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REDIRECT_URI = process.env.STRAVA_REDIRECT_URI || `http://localhost:${PORT}/api/strava/callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn('[strava] STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET are not set. Copy server/.env.example to server/.env and fill them in.');
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('[coach] ANTHROPIC_API_KEY is not set. /api/coach/* routes will fail until server/.env has it.');
}

const app = express();
app.use(express.json());
const creds = { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET };

// GET /api/user — the (single) user's persisted profile and onboarding data
app.get('/api/user', (_req, res) => {
  res.json(getUser());
});

// PATCH /api/user — shallow-merge a patch into the persisted user, onboarding merged one level deep
app.patch('/api/user', (req, res) => {
  res.json(updateUser(req.body ?? {}));
});

// DELETE /api/user — wipe the persisted profile and disconnect Strava, back to a fresh install
app.delete('/api/user', async (_req, res) => {
  await strava.deauthorize(creds).catch(() => {});
  res.json(resetUser());
});

// POST /api/coach/chat — { message, history, context } -> { reply }
app.post('/api/coach/chat', async (req, res) => {
  const { message, history, context } = req.body ?? {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  try {
    const reply = await chatWithCoach({ message, history, context });
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'llm_error', message: err.message });
  }
});

// POST /api/coach/amend — { freeText, context } -> { title, explanation }
app.post('/api/coach/amend', async (req, res) => {
  const { freeText, context } = req.body ?? {};
  if (typeof freeText !== 'string' || !freeText.trim()) {
    return res.status(400).json({ error: 'freeText is required' });
  }
  try {
    const result = await amendPrescription({ freeText, context });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'llm_error', message: err.message });
  }
});

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

// GET /api/strava/fitness — derives onboarding "starting fitness" fields from real activities
app.get('/api/strava/fitness', async (_req, res) => {
  try {
    const fitness = await strava.computeFitnessFromActivities(creds);
    res.json({ ok: true, fitness });
  } catch (err) {
    if (err.code === 'NOT_CONNECTED') {
      return res.status(401).json({ ok: false, error: 'not_connected' });
    }
    console.error(err);
    res.status(502).json({ ok: false, error: 'strava_api_error', message: err.message });
  }
});

// GET /api/strava/insights — real beliefs (threshold pace, weekly load, easy-day
// discipline) plus threshold pace / max HR, all derived from actual activities
app.get('/api/strava/insights', async (_req, res) => {
  try {
    const insights = await strava.computeInsightsFromActivities(creds);
    res.json({ ok: true, ...insights });
  } catch (err) {
    if (err.code === 'NOT_CONNECTED') {
      return res.status(401).json({ ok: false, error: 'not_connected' });
    }
    console.error(err);
    res.status(502).json({ ok: false, error: 'strava_api_error', message: err.message });
  }
});

// GET /api/strava/today — real prescription for today, computed from Strava
// history: threshold pace (Riegel), CTL/ATL/TSB (Banister model), ACWR, and
// the current periodization phase all feed a rule-based session decision.
app.get('/api/strava/today', async (_req, res) => {
  try {
    const result = await buildToday(creds, getUser());
    res.json(result);
  } catch (err) {
    if (err.code === 'NOT_CONNECTED') {
      return res.status(401).json({ ok: false, error: 'not_connected' });
    }
    console.error(err);
    res.status(502).json({ ok: false, error: 'strava_api_error', message: err.message });
  }
});

// GET /api/strava/plan — this week's real + generated sessions, phase bar,
// and weekly load history, built on the same training-engine math as /today.
app.get('/api/strava/plan', async (_req, res) => {
  try {
    const result = await buildPlan(creds, getUser());
    res.json(result);
  } catch (err) {
    if (err.code === 'NOT_CONNECTED') {
      return res.status(401).json({ ok: false, error: 'not_connected' });
    }
    console.error(err);
    res.status(502).json({ ok: false, error: 'strava_api_error', message: err.message });
  }
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
