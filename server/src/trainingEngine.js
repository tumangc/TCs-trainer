// Real training-plan math from real Strava activities. Every function here
// is pure (no network, no fs) so it can be unit tested with synthetic data.
// Models used, all standard and named rather than invented:
//   - Riegel's race-time prediction formula (1977) to extrapolate a hard
//     effort to a threshold-equivalent (~60 min) pace when no direct
//     threshold-duration effort exists.
//   - Threshold-relative pace zones (Pfitzinger-style): Easy/Marathon/
//     Threshold/Interval/Repetition as fixed percentages of threshold speed.
//   - The Banister impulse-response model (CTL/ATL/TSB), the same fitness/
//     fatigue/form math TrainingPeaks uses, fed by a pace-based Training
//     Stress Score (no power meter available, so TSS = hours x IF^2 x 100
//     with IF = pace / threshold pace — the standard no-power TSS proxy).
//   - ACWR (Acute:Chronic Workload Ratio, Gabbett 2016) as an injury-risk
//     guardrail on how fast weekly load is allowed to ramp.
//   - Standard endurance periodization (Base/Build/Peak/Taper), anchored to
//     the real date onboarding was completed through the goal date, so
//     phase state (done/current/upcoming) reflects actual elapsed time.
//
// Known simplifications (documented, not hidden): CTL/ATL are seeded at 0
// at the start of the fetched activity window, so the first ~6 weeks of a
// short history under-estimate true fitness (a known limitation of any DIY
// Banister implementation without a longer lead-in); threshold-zone
// percentages are approximate, consistent with commonly published
// threshold-relative training-pace systems rather than a single citable
// universal constant; and periodization proportions (taper length, Base/
// Build/Peak split) are a standard rule-of-thumb, not a rigid law — coaches
// vary these.

const DAY_MS = 24 * 3600 * 1000;

function isRun(a) {
  return a.type === 'Run' || a.sport_type === 'Run';
}

export function paceStringFromSpeed(metersPerSecond) {
  if (!metersPerSecond || metersPerSecond <= 0) return '—';
  const totalSeconds = Math.round(1000 / metersPerSecond);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

// --- Riegel ---

export function riegelTimeForDistance(knownDistanceM, knownTimeSec, targetDistanceM, exponent = 1.06) {
  return knownTimeSec * Math.pow(targetDistanceM / knownDistanceM, exponent);
}

export function riegelDistanceForTime(knownDistanceM, knownTimeSec, targetTimeSec, exponent = 1.06) {
  return knownDistanceM * Math.pow(targetTimeSec / knownTimeSec, 1 / exponent);
}

// --- Threshold pace estimation ---

export function estimateThreshold(activities) {
  const runs = activities.filter(isRun);
  const hardEfforts = runs.filter(
    (r) => (r.workout_type === 1 || r.workout_type === 3) && r.average_speed > 0 && r.moving_time >= 480,
  );
  if (hardEfforts.length === 0) return null;

  // Prefer whichever tagged effort is closest to a 60-minute threshold
  // duration — least extrapolation needed.
  const best = hardEfforts.reduce((a, b) => (Math.abs(b.moving_time - 3600) < Math.abs(a.moving_time - 3600) ? b : a));

  if (best.moving_time >= 900 && best.moving_time <= 4200) {
    return {
      thresholdSpeed: best.average_speed,
      method: 'measured',
      sourceName: best.name,
      sourceDate: (best.start_date || '').slice(0, 10),
      sourceMinutes: Math.round(best.moving_time / 60),
    };
  }

  const equivDistance = riegelDistanceForTime(best.distance, best.moving_time, 3600);
  return {
    thresholdSpeed: equivDistance / 3600,
    method: 'riegel-extrapolated',
    sourceName: best.name,
    sourceDate: (best.start_date || '').slice(0, 10),
    sourceMinutes: Math.round(best.moving_time / 60),
  };
}

// --- Pace zones, as a fraction of threshold speed ---

const ZONE_FACTORS = {
  easy: 0.83,
  marathon: 0.91,
  threshold: 1.0,
  interval: 1.07,
  repetition: 1.15,
};

export function computePaceZones(thresholdSpeed) {
  const zones = {};
  for (const [name, factor] of Object.entries(ZONE_FACTORS)) {
    const speed = thresholdSpeed * factor;
    zones[name] = { speed, pace: paceStringFromSpeed(speed) };
  }
  return zones;
}

// --- Training Stress Score, per day ---

export function computeDailyTss(activities, thresholdSpeed) {
  const byDay = new Map();
  if (!thresholdSpeed) return byDay;
  for (const r of activities.filter(isRun)) {
    if (!r.average_speed || !r.moving_time || !r.start_date) continue;
    const intensityFactor = r.average_speed / thresholdSpeed;
    const hours = r.moving_time / 3600;
    const tss = hours * intensityFactor * intensityFactor * 100;
    const day = r.start_date.slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + tss);
  }
  return byDay;
}

// --- Banister CTL/ATL/TSB, standard 42/7-day time constants ---

export function computeLoadSeries(dailyTssMap, days, now = Date.now()) {
  const series = [];
  let ctl = 0;
  let atl = 0;
  const start = now - (days - 1) * DAY_MS;
  for (let i = 0; i < days; i++) {
    const key = new Date(start + i * DAY_MS).toISOString().slice(0, 10);
    const tss = dailyTssMap.get(key) || 0;
    ctl += (tss - ctl) / 42;
    atl += (tss - atl) / 7;
    series.push({ date: key, tss, ctl, atl, tsb: ctl - atl });
  }
  return series;
}

export function acwr(ctl, atl) {
  if (!ctl) return null;
  return atl / ctl;
}

// --- Periodization: Base / Build / Peak / Taper ---

export function computePeriodization(blockStartDate, goalDate, today = new Date()) {
  const totalDays = Math.max(1, Math.round((goalDate - blockStartDate) / DAY_MS));
  const elapsedDays = Math.round((today - blockStartDate) / DAY_MS);
  const daysOut = Math.round((goalDate - today) / DAY_MS);

  const taperDays = totalDays >= 42 ? 14 : totalDays >= 21 ? Math.min(7, totalDays) : 0;
  const remaining = totalDays - taperDays;
  const peakDays = Math.max(0, Math.round(remaining * 0.2));
  const buildDays = Math.max(0, Math.round(remaining * 0.45));
  const baseDays = Math.max(0, remaining - peakDays - buildDays);

  const defs = [
    { label: 'Base', days: baseDays },
    { label: 'Build', days: buildDays },
    { label: 'Peak', days: peakDays },
    { label: 'Taper', days: taperDays },
  ].filter((p) => p.days > 0);

  let cursor = 0;
  const phases = defs.map((p) => {
    const start = cursor;
    const end = cursor + p.days;
    cursor = end;
    const state = elapsedDays >= end ? 'done' : elapsedDays < start ? 'upcoming' : 'current';
    return { label: p.label, weeks: `${Math.max(1, Math.round(p.days / 7))}w`, fraction: p.days / totalDays, state };
  });

  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
  const weekNum = Math.min(totalWeeks, Math.max(1, Math.ceil((elapsedDays + 1) / 7)));
  const currentPhase = phases.find((p) => p.state === 'current') ?? phases[phases.length - 1] ?? { label: 'Base' };

  return { phases, totalWeeks, weekNum, daysOut, currentPhaseLabel: currentPhase.label };
}

// --- Today's prescription: a rule-based decision over the real signals above ---

const SESSION_TSS_BASE = { easy: 45, threshold: 75, long: 95, interval: 70, rest: 0 };
const PHASE_QUALITY = {
  Base: 'threshold',
  Build: 'interval',
  Peak: 'interval',
  Taper: 'threshold',
};

function scaleTssForFitness(baseTss, ctl) {
  const factor = Math.min(1.6, Math.max(0.6, ctl / 40));
  return Math.round(baseTss * factor);
}

function minutesForTss(targetTss, speed, thresholdSpeed) {
  const intensityFactor = speed / thresholdSpeed;
  const hours = Math.sqrt(targetTss / 100) / intensityFactor;
  return Math.max(10, Math.round(hours * 60));
}

// Inverse of minutesForTss — the TSS a session of a given duration/pace
// represents. Shared by planAssembler so "planned load" numbers shown to
// the user and the load fed back into the CTL/ATL forward simulation are
// computed the same way, not two hand-rolled copies that can drift apart.
export function sessionTss(minutes, speed, thresholdSpeed) {
  if (!minutes || !speed || !thresholdSpeed) return 0;
  const intensityFactor = speed / thresholdSpeed;
  const hours = minutes / 60;
  return Math.round(hours * intensityFactor * intensityFactor * 100);
}

export function decideTodaySession({
  today,
  offDays,
  timeCapMinutes,
  phaseLabel,
  isTaperLate,
  ctl,
  tsb,
  daysSinceQuality,
  zones,
  thresholdSpeed,
}) {
  const weekday = today.toLocaleDateString('en-US', { weekday: 'short' });
  const isOffDay = offDays.includes(weekday);
  const isLongRunDay = weekday === 'Sat' && !isOffDay;
  const wantsQuality = weekday === 'Thu' && !isOffDay && daysSinceQuality >= 2 && tsb > -25 && !isTaperLate;

  if (isOffDay) {
    return { type: 'rest', title: 'Rest day', reason: `${weekday} is a day you told me you can't run.` };
  }

  if (tsb <= -25) {
    const minutes = Math.min(timeCapMinutes, minutesForTss(scaleTssForFitness(SESSION_TSS_BASE.easy, ctl) * 0.7, zones.easy.speed, thresholdSpeed));
    return {
      type: 'easy',
      title: `${minutes} min easy @ ${zones.easy.pace}`,
      minutes,
      speed: zones.easy.speed,
      reason: `Your training stress balance is ${Math.round(tsb)} — deep in fatigue. Easy or nothing until it recovers.`,
    };
  }

  if (isLongRunDay) {
    const targetTss = isTaperLate ? scaleTssForFitness(SESSION_TSS_BASE.long, ctl) * 0.6 : scaleTssForFitness(SESSION_TSS_BASE.long, ctl);
    const minutes = Math.min(timeCapMinutes * 2, minutesForTss(targetTss, zones.marathon.speed, thresholdSpeed));
    const km = Math.round((zones.marathon.speed * minutes * 60) / 100) / 10;
    return {
      type: 'long',
      title: `${km} km long run @ ${zones.marathon.pace}`,
      minutes,
      speed: zones.marathon.speed,
      reason: `Long run day. ${isTaperLate ? 'Cut for taper.' : `Sized to your current fitness (CTL ${Math.round(ctl)}).`}`,
    };
  }

  if (wantsQuality) {
    const kind = PHASE_QUALITY[phaseLabel] ?? 'threshold';
    const zone = zones[kind];
    const targetTss = scaleTssForFitness(SESSION_TSS_BASE[kind] ?? SESSION_TSS_BASE.threshold, ctl);
    const totalMinutes = Math.min(timeCapMinutes, minutesForTss(targetTss, zone.speed, thresholdSpeed));
    if (totalMinutes <= 22) {
      return {
        type: kind,
        title: `${totalMinutes} min ${kind} @ ${zone.pace}`,
        minutes: totalMinutes,
        speed: zone.speed,
        reason: `${phaseLabel} phase quality day, sized to fit your ${timeCapMinutes}-min cap.`,
      };
    }
    const repMinutes = kind === 'interval' ? 4 : 8;
    const reps = Math.max(2, Math.round(totalMinutes / (repMinutes + 2)));
    return {
      type: kind,
      title: `${reps} x ${repMinutes} min @ ${zone.pace} (2 min float)`,
      minutes: totalMinutes,
      speed: zone.speed,
      reason: `${phaseLabel} phase calls for ${kind}. Last quality session was ${daysSinceQuality} day${daysSinceQuality === 1 ? '' : 's'} ago, so today's cleared.`,
    };
  }

  const minutes = Math.min(timeCapMinutes, minutesForTss(scaleTssForFitness(SESSION_TSS_BASE.easy, ctl), zones.easy.speed, thresholdSpeed));
  return {
    type: 'easy',
    title: `${minutes} min easy @ ${zones.easy.pace}`,
    minutes,
    speed: zones.easy.speed,
    reason: 'Recovery between the days that matter.',
  };
}
