import { strava } from './strava.js';
import { computeDailyTss, computeLoadSeries, computePaceZones, estimateThreshold } from './trainingEngine.js';

export const DAY_MS = 24 * 3600 * 1000;
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const HISTORY_DAYS = 180;

export function isRun(a) {
  return a.type === 'Run' || a.sport_type === 'Run';
}

export function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

// Strava paginates at 200/page max; two pages covers ~180 days for anyone
// running fewer than ~3 times a day on average (a documented limit, not
// silently wrong for the rare higher-frequency athlete).
export async function fetchHistory(creds) {
  const [page1, page2] = await Promise.all([
    strava.callApi('/athlete/activities', creds, { per_page: 100, page: 1 }),
    strava.callApi('/athlete/activities', creds, { per_page: 100, page: 2 }),
  ]);
  return [...page1, ...page2];
}

export function summarizeRuns(runs, thresholdSpeed) {
  const totalKm = runs.reduce((s, r) => s + r.distance, 0) / 1000;
  const totalTss = Math.round(
    runs.reduce((s, r) => s + (r.average_speed ? (r.moving_time / 3600) * Math.pow(r.average_speed / thresholdSpeed, 2) * 100 : 0), 0),
  );
  const hasQuality = runs.some((r) => r.workout_type === 1 || r.workout_type === 3);
  return { totalKm, totalTss, hasQuality, name: runs[0]?.name, pace: runs[0]?.average_speed };
}

export function buildSignals(activities, now = new Date()) {
  const threshold = estimateThreshold(activities);
  if (!threshold) return null;
  const zones = computePaceZones(threshold.thresholdSpeed);
  const dailyTss = computeDailyTss(activities, threshold.thresholdSpeed);
  const loadSeries = computeLoadSeries(dailyTss, HISTORY_DAYS, now.getTime());
  const todayEntry = loadSeries[loadSeries.length - 1];

  const qualityRuns = activities
    .filter((a) => isRun(a) && (a.workout_type === 1 || a.workout_type === 3))
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
  const lastQualityDate = qualityRuns[0] ? new Date(qualityRuns[0].start_date) : null;
  const daysSinceQuality = lastQualityDate ? Math.round((now - lastQualityDate) / DAY_MS) : 99;

  const activitiesByDay = new Map();
  for (const a of activities.filter(isRun)) {
    const key = (a.start_date || '').slice(0, 10);
    if (!activitiesByDay.has(key)) activitiesByDay.set(key, []);
    activitiesByDay.get(key).push(a);
  }

  return { threshold, zones, dailyTss, loadSeries, todayEntry, daysSinceQuality, activitiesByDay };
}
