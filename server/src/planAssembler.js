import { strava } from './strava.js';
import {
  acwr,
  computeDailyTss,
  computeLoadSeries,
  computePaceZones,
  computePeriodization,
  decideTodaySession,
  estimateThreshold,
  paceStringFromSpeed,
  sessionTss,
} from './trainingEngine.js';

const DAY_MS = 24 * 3600 * 1000;
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HISTORY_DAYS = 180;
const QUALITY_TYPES = new Set(['threshold', 'interval', 'long']);

function isRun(a) {
  return a.type === 'Run' || a.sport_type === 'Run';
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function timeCapMinutes(timeCapLabel) {
  const match = /(\d+)/.exec(timeCapLabel || '');
  return match ? Number(match[1]) : 60;
}

// Strava paginates at 200/page max; two pages covers ~180 days for anyone
// running fewer than ~3 times a day on average (a documented limit, not
// silently wrong for the rare higher-frequency athlete).
async function fetchHistory(creds) {
  const [page1, page2] = await Promise.all([
    strava.callApi('/athlete/activities', creds, { per_page: 100, page: 1 }),
    strava.callApi('/athlete/activities', creds, { per_page: 100, page: 2 }),
  ]);
  return [...page1, ...page2];
}

function summarizeRuns(runs, thresholdSpeed) {
  const totalKm = runs.reduce((s, r) => s + r.distance, 0) / 1000;
  const totalTss = Math.round(
    runs.reduce((s, r) => s + (r.average_speed ? (r.moving_time / 3600) * Math.pow(r.average_speed / thresholdSpeed, 2) * 100 : 0), 0),
  );
  const hasQuality = runs.some((r) => r.workout_type === 1 || r.workout_type === 3);
  return { totalKm, totalTss, hasQuality, name: runs[0]?.name, pace: runs[0]?.average_speed };
}

function buildSignals(activities, now = new Date()) {
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

function currentPeriod(onboarding, blockStartDate, now) {
  const goalDate = onboarding.date ? new Date(onboarding.date) : null;
  const isRaceGoal = onboarding.goalKind === 'Race' && goalDate && !Number.isNaN(goalDate.getTime()) && blockStartDate;
  if (!isRaceGoal) return { period: null, phaseLabel: 'Ongoing', isTaperLate: false };
  const period = computePeriodization(new Date(blockStartDate), goalDate, now);
  const isTaperLate = period.currentPhaseLabel === 'Taper' && period.daysOut <= 7;
  return { period, phaseLabel: period.currentPhaseLabel, isTaperLate };
}

export async function buildToday(creds, user) {
  const activities = await fetchHistory(creds);
  const signals = buildSignals(activities);
  if (!signals) return { ok: false, error: 'insufficient_data' };

  const now = new Date();
  const { onboarding, blockStartDate } = user;
  const { period, phaseLabel, isTaperLate } = currentPeriod(onboarding, blockStartDate, now);

  const todayRuns = signals.activitiesByDay.get(dayKey(now)) ?? [];
  const ratio = acwr(signals.todayEntry.ctl, signals.todayEntry.atl);

  if (todayRuns.length > 0) {
    const summary = summarizeRuns(todayRuns, signals.threshold.thresholdSpeed);
    return {
      ok: true,
      dateLabel: `${WEEKDAY_SHORT[now.getDay()]} ${now.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}${period ? ` · wk ${period.weekNum}/${period.totalWeeks} · ${phaseLabel.toLowerCase()}` : ''}`,
      prescription: {
        kicker: 'Already logged today',
        revisedTag: 'From Strava',
        title: `${summary.name} · ${summary.totalKm.toFixed(1)} km`,
        subtitle: `${paceStringFromSpeed(summary.pace)} · ${summary.totalTss} TSS`,
        rowsFull: [
          { label: 'Volume', value: `${summary.totalKm.toFixed(1)} km` },
          { label: 'Pace', value: paceStringFromSpeed(summary.pace) },
          { label: 'Load', value: `${summary.totalTss} TSS` },
          { label: 'Training stress balance', value: `${Math.round(signals.todayEntry.tsb)}` },
        ],
        rowsSimple: [
          { label: 'Volume', value: `${summary.totalKm.toFixed(1)} km` },
          { label: 'Effort', value: summary.hasQuality ? 'Quality' : 'Easy' },
        ],
        sentToWatch: false,
      },
      basis: [
        { value: `TSB ${Math.round(signals.todayEntry.tsb)}`, note: signals.todayEntry.tsb < -10 ? 'Carrying fatigue' : signals.todayEntry.tsb > 5 ? 'Fresh' : 'Balanced' },
        { value: `CTL ${Math.round(signals.todayEntry.ctl)}`, note: '42-day training load (fitness)' },
        { value: ratio ? `ACWR ${ratio.toFixed(2)}` : 'ACWR —', note: 'Acute:chronic load ratio (0.8–1.3 is the safe band)' },
      ],
      basisExplainer: `You've already logged today's run on Strava — nothing left to prescribe. Threshold pace is ${paceStringFromSpeed(signals.threshold.thresholdSpeed)} (${signals.threshold.method === 'measured' ? `from "${signals.threshold.sourceName}"` : `extrapolated from "${signals.threshold.sourceName}" via Riegel's formula`}).`,
      openQuestions: [],
      questionsScope: '',
    };
  }

  const decision = decideTodaySession({
    today: now,
    offDays: onboarding.offDays ?? [],
    timeCapMinutes: timeCapMinutes(onboarding.timeCap),
    phaseLabel,
    isTaperLate,
    ctl: signals.todayEntry.ctl,
    tsb: signals.todayEntry.tsb,
    daysSinceQuality: signals.daysSinceQuality,
    zones: signals.zones,
    thresholdSpeed: signals.threshold.thresholdSpeed,
  });
  const tssPlanned = sessionTss(decision.minutes, decision.speed, signals.threshold.thresholdSpeed);

  return {
    ok: true,
    dateLabel: `${WEEKDAY_SHORT[now.getDay()]} ${now.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}${period ? ` · wk ${period.weekNum}/${period.totalWeeks} · ${phaseLabel.toLowerCase()}` : ''}`,
    prescription: {
      kicker: `Prescription · ${decision.type}`,
      revisedTag: 'Computed from Strava just now',
      title: decision.title,
      subtitle: decision.reason,
      rowsFull: [
        { label: 'Volume', value: decision.minutes ? `${decision.minutes} min` : '—' },
        { label: 'Target pace', value: decision.speed ? paceStringFromSpeed(decision.speed) : '—' },
        { label: 'Planned load', value: tssPlanned ? `${tssPlanned} TSS` : '—' },
        { label: 'Training stress balance', value: `${Math.round(signals.todayEntry.tsb)}` },
      ],
      rowsSimple: [
        { label: 'Volume', value: decision.minutes ? `${decision.minutes} min` : '—' },
        { label: 'Effort', value: decision.type },
      ],
      sentToWatch: false,
    },
    basis: [
      { value: `TSB ${Math.round(signals.todayEntry.tsb)}`, note: signals.todayEntry.tsb < -10 ? 'Carrying fatigue' : signals.todayEntry.tsb > 5 ? 'Fresh' : 'Balanced' },
      { value: `CTL ${Math.round(signals.todayEntry.ctl)}`, note: '42-day training load (fitness)' },
      { value: ratio ? `ACWR ${ratio.toFixed(2)}` : 'ACWR —', note: 'Acute:chronic load ratio (0.8–1.3 is the safe band)' },
    ],
    basisExplainer: `${decision.reason} Threshold pace is ${paceStringFromSpeed(signals.threshold.thresholdSpeed)} (${signals.threshold.method === 'measured' ? `from "${signals.threshold.sourceName}"` : `extrapolated from "${signals.threshold.sourceName}" via Riegel's formula`}).`,
    openQuestions: [],
    questionsScope: '',
  };
}

export async function buildPlan(creds, user) {
  const activities = await fetchHistory(creds);
  const signals = buildSignals(activities);
  if (!signals) return { ok: false, error: 'insufficient_data' };

  const now = new Date();
  const todayKey = dayKey(now);
  const { onboarding, blockStartDate } = user;
  const { period, phaseLabel, isTaperLate } = currentPeriod(onboarding, blockStartDate, now);
  const capMinutes = timeCapMinutes(onboarding.timeCap);
  const offDays = onboarding.offDays ?? [];
  const thresholdSpeed = signals.threshold.thresholdSpeed;

  const dayOfWeekMon0 = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - dayOfWeekMon0);

  // Forward-simulate CTL/ATL/days-since-quality day by day for anything not
  // yet run, so an easy day right after a hard one actually looks different
  // from one earlier in the week — rather than freezing today's numbers and
  // reusing them for every future day.
  let simCtl = signals.todayEntry.ctl;
  let simAtl = signals.todayEntry.atl;
  let simDaysSinceQuality = signals.daysSinceQuality;

  const sessions = [];
  let weekKm = 0;
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday.getTime() + i * DAY_MS);
    const key = dayKey(date);
    const dayLabel = WEEKDAY_SHORT[date.getDay()];
    const isToday = key === todayKey;
    const runs = signals.activitiesByDay.get(key) ?? [];

    if (runs.length > 0) {
      const summary = summarizeRuns(runs, thresholdSpeed);
      weekKm += summary.totalKm;
      sessions.push({
        id: key,
        day: dayLabel,
        title: `${summary.name} · ${summary.totalKm.toFixed(1)} km`,
        detail: paceStringFromSpeed(summary.pace),
        status: 'Logged',
        load: summary.totalTss,
        emphasis: summary.hasQuality ? 'accent-dim' : 'neutral',
      });
      continue;
    }

    if (date < now && !isToday) {
      sessions.push({ id: key, day: dayLabel, title: 'Rest', detail: 'No run logged', status: 'Logged', load: null, emphasis: 'neutral' });
      continue;
    }

    // Today (not yet run) or a future day: decide it, then roll the
    // simulation forward so the next iteration sees today's assumed load.
    const decision = decideTodaySession({
      today: date,
      offDays,
      timeCapMinutes: capMinutes,
      phaseLabel,
      isTaperLate,
      ctl: simCtl,
      tsb: simCtl - simAtl,
      daysSinceQuality: simDaysSinceQuality,
      zones: signals.zones,
      thresholdSpeed,
    });
    const tss = sessionTss(decision.minutes, decision.speed, thresholdSpeed);
    simCtl += (tss - simCtl) / 42;
    simAtl += (tss - simAtl) / 7;
    simDaysSinceQuality = QUALITY_TYPES.has(decision.type) ? 0 : simDaysSinceQuality + 1;
    if (decision.minutes && decision.speed) weekKm += (decision.speed * decision.minutes * 60) / 1000;

    sessions.push({
      id: key,
      day: dayLabel,
      title: decision.title,
      detail: decision.reason,
      status: isToday ? 'Today' : 'Planned',
      load: tss || null,
      emphasis: isToday ? 'accent' : QUALITY_TYPES.has(decision.type) ? 'accent-dim' : 'neutral',
    });
  }

  // Weekly load history for the chart: last 14 weeks of summed TSS, real data only.
  const weeks = [];
  for (let w = 13; w >= 0; w--) {
    const weekStart = monday.getTime() - w * 7 * DAY_MS;
    let sum = 0;
    for (let d = 0; d < 7; d++) {
      sum += signals.dailyTss.get(dayKey(new Date(weekStart + d * DAY_MS))) || 0;
    }
    weeks.push(Math.round(sum));
  }
  const maxWeek = Math.max(1, ...weeks);
  const thisWeekLoad = sessions.reduce((s, sess) => s + (sess.load || 0), 0);
  const lastWeekLoad = weeks[weeks.length - 2] || 0;
  const deltaPct = lastWeekLoad > 0 ? Math.round(((thisWeekLoad - lastWeekLoad) / lastWeekLoad) * 100) : 0;
  weeks[weeks.length - 1] = thisWeekLoad;

  return {
    ok: true,
    block: {
      raceLabel: period ? `Block · ${onboarding.race}` : 'Ongoing training',
      weekLabel: period ? `Week ${period.weekNum} of ${period.totalWeeks}` : 'Rolling weeks',
      daysOut: period?.daysOut ?? 0,
      phases: period?.phases ?? [{ label: 'Ongoing', weeks: '—', fraction: 1, state: 'current' }],
      weeklyLoad: { value: thisWeekLoad, deltaPct, bars: weeks.map((w) => w / maxWeek), currentIndex: weeks.length - 1 },
      keySessionsRemaining: sessions.filter((s) => s.status !== 'Logged' && s.emphasis !== 'neutral').length,
      keySessions: sessions
        .filter((s) => s.status !== 'Logged' && s.emphasis !== 'neutral')
        .map((s) => ({ title: s.title, when: s.day, highlighted: s.status === 'Today' })),
    },
    weekSummary: `This week · ${weekKm.toFixed(0)} km · ${thisWeekLoad} load`,
    sessions,
  };
}
