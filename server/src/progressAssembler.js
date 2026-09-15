import { buildSignals, fetchHistory } from './stravaHistory.js';
import {
  computeBests,
  computeRacePredictionSeries,
  computeWeeklyKmSeries,
  formatRaceTime,
  guessRaceDistanceMeters,
  normalizeSeries,
  parseTimeToSeconds,
  raceLabelFromMeters,
  sampleWeekly,
} from './trainingEngine.js';

const WEEKS = 12;

export async function buildProgress(creds, user) {
  const activities = await fetchHistory(creds);
  const signals = buildSignals(activities);
  if (!signals) return { ok: false, error: 'insufficient_data' };

  const now = new Date();
  const { onboarding, blockStartDate } = user;

  const ctlWeekly = sampleWeekly(
    signals.loadSeries.map((d) => d.ctl),
    WEEKS,
  );
  const atlWeekly = sampleWeekly(
    signals.loadSeries.map((d) => d.atl),
    WEEKS,
  );
  const { series: fitness } = normalizeSeries(ctlWeekly, undefined, true);
  const { series: fatigue } = normalizeSeries(atlWeekly, undefined, true);
  const { ctl, atl, tsb } = signals.todayEntry;

  const trendDelta = ctlWeekly[ctlWeekly.length - 1] - ctlWeekly[0];
  const fitnessTrend = trendDelta > 2 ? 'risen' : trendDelta < -2 ? 'fallen' : 'held steady';
  const formNote = tsb > 5 ? 'You are fresh.' : tsb < -10 ? 'You are carrying real fatigue.' : 'Form is balanced.';
  const loadNote = `Fitness has ${fitnessTrend} over the last ${WEEKS} weeks. ${formNote} TSB is ${Math.round(tsb)}.`;

  const goalDistanceMeters = guessRaceDistanceMeters(onboarding.race || onboarding.goalKind || '');
  const goalSeconds = parseTimeToSeconds(onboarding.goalTime);
  const predictionSeconds = computeRacePredictionSeries(activities, goalDistanceMeters, WEEKS, now.getTime());
  const currentSeconds = predictionSeconds[predictionSeconds.length - 1];
  const { series: raceSeries, referenceNormalized: goalLine } = normalizeSeries(predictionSeconds, goalSeconds, false);
  const crossedIndex = goalSeconds ? predictionSeconds.findIndex((s) => s !== null && s <= goalSeconds) : -1;
  const crossedWeekLabel =
    crossedIndex === -1
      ? goalSeconds
        ? "Hasn't crossed goal pace yet"
        : "No parseable goal time to compare against"
      : `Crossed the goal line in week ${crossedIndex + 1}`;

  const weeklyKm = computeWeeklyKmSeries(activities, WEEKS, now.getTime());
  const maxKm = Math.max(1, ...weeklyKm);

  const sinceLabel = blockStartDate
    ? `Since ${new Date(blockStartDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long' })} · ${WEEKS} weeks`
    : `Last ${WEEKS} weeks`;

  return {
    ok: true,
    sinceLabel,
    loadForm: {
      ctl: Math.round(ctl),
      atl: Math.round(atl),
      tsb: Math.round(tsb),
      fitness,
      fatigue,
      note: loadNote,
    },
    racePrediction: {
      raceLabel: raceLabelFromMeters(goalDistanceMeters),
      current: currentSeconds ? formatRaceTime(currentSeconds) : '—',
      goal: onboarding.goalTime || '—',
      goalLine: goalLine ?? 0.5,
      crossedWeekLabel,
      series: raceSeries,
      note: "Prediction from your threshold pace via Riegel's formula, recomputed weekly from your actual runs.",
    },
    weeklyVolume: {
      series: weeklyKm.map((km) => km / maxKm),
      sinceLabel: `${WEEKS} wks ago`,
      currentLabel: `${weeklyKm[weeklyKm.length - 1].toFixed(0)} km this week`,
    },
    bests: computeBests(activities),
  };
}
