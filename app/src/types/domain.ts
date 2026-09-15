// Domain types for TCs Trainer. These describe the shape of data the UI
// needs; CoachService is the seam a real backend/AI integration will
// eventually implement in place of the mock.

export type Density = 'simple' | 'full';

export interface PrescriptionRow {
  label: string;
  value: string;
}

export interface TodayPrescription {
  kicker: string;
  revisedTag: string;
  title: string;
  subtitle: string;
  rowsFull: PrescriptionRow[];
  rowsSimple: PrescriptionRow[];
  sentToWatch: boolean;
}

export interface AmendResult {
  title: string;
  explanation: string;
}

export interface BasisItem {
  value: string;
  note: string;
}

export interface OpenQuestion {
  id: string;
  text: string;
  answers: string[];
}

export interface TodayData {
  dateLabel: string;
  sessionLabel: string;
  prescription: TodayPrescription;
  basis: BasisItem[];
  basisExplainer: string;
  openQuestions: OpenQuestion[];
  questionsScope: string;
}

export type PhaseState = 'done' | 'current' | 'upcoming';

export interface BlockPhase {
  label: string;
  weeks: string;
  /** relative width of this phase in the phase bar, 0-1 */
  fraction: number;
  state: PhaseState;
}

export interface KeySession {
  title: string;
  when: string;
  highlighted?: boolean;
}

export interface BlockOverview {
  raceLabel: string;
  weekLabel: string;
  daysOut: number;
  phases: BlockPhase[];
  weeklyLoad: {
    value: number;
    deltaPct: number;
    /** normalized 0-1 bar heights, oldest to newest */
    bars: number[];
    currentIndex: number;
  };
  keySessionsRemaining: number;
  keySessions: KeySession[];
}

export interface PlanChangeNotice {
  message: string;
}

export type PlanSessionStatus = 'Logged' | 'Fast' | 'Today' | 'Planned';

export interface PlanSession {
  id: string;
  day: string;
  title: string;
  detail: string;
  status: PlanSessionStatus;
  load: number | null;
  emphasis: 'accent' | 'accent-dim' | 'neutral';
  analysisId?: string;
}

export interface PlanData {
  block: BlockOverview;
  changeNotice?: PlanChangeNotice;
  weekSummary: string;
  sessions: PlanSession[];
}

export interface ProgressData {
  sinceLabel: string;
  loadForm: {
    ctl: number;
    atl: number;
    tsb: number;
    /** normalized 0-1, oldest to newest */
    fitness: number[];
    fatigue: number[];
    note: string;
  };
  racePrediction: {
    current: string;
    goal: string;
    /** normalized 0-1 position of the goal line */
    goalLine: number;
    crossedWeekLabel: string;
    /** normalized 0-1, oldest to newest */
    series: number[];
    note: string;
  };
  weeklyVolume: {
    /** normalized 0-1, oldest to newest */
    series: number[];
    sinceLabel: string;
    currentLabel: string;
  };
  bests: { distance: string; time: string; delta: string }[];
}

export interface RunStat {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface TimelinePoint {
  at: string;
  label: string;
  metric: string;
  note?: string;
}

export interface AnalysisData {
  id: string;
  dateLabel: string;
  title: string;
  duration: string;
  verdictTag: string;
  verdictHeadline: string;
  stats: RunStat[];
  paceHr: {
    /** normalized 0-1, oldest to newest, same length as hr */
    pace: number[];
    hr: number[];
    pinnedIndices: number[];
  };
  notesPinned: number;
  timeline: TimelinePoint[];
  whatThisChanges: string[];
}

export type GoalKind = 'Race' | 'Distance goal' | 'Just consistent';

export interface OnboardingGoal {
  kind: GoalKind;
  race: string;
  date: string;
  goalTime: string;
  note: string;
}

export interface OnboardingConstraints {
  offDays: string[];
  timeCap: string;
  cross: string[];
  recurring: string;
  note: string;
}

export type Confidence = 'Low' | 'Medium' | 'High';

export interface FitnessRead {
  label: string;
  value: string;
  confidence: Confidence;
}

export interface OnboardingFitness {
  recentRaceDist: string;
  recentRaceTime: string;
  weeklyKm: string;
  yearsRunning: string;
  reads: FitnessRead[];
}

export interface PreviewSession {
  day: string;
  title: string;
  meta: string;
  highlighted: boolean;
}

export interface OnboardingPreview {
  phases: BlockPhase[];
  week: PreviewSession[];
  guesses: string[];
}

export interface OnboardingData {
  goal: OnboardingGoal;
  constraints: OnboardingConstraints;
  fitness: OnboardingFitness;
  preview: OnboardingPreview;
}

export const OFF_DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const TIME_CAP_OPTIONS = ['45 min', '60 min', '90 min', 'No cap'] as const;
export const CROSS_TRAIN_OPTIONS = ['Bike', 'Swim', 'Strength', 'Climbing'] as const;
export const GOAL_KIND_OPTIONS: GoalKind[] = ['Race', 'Distance goal', 'Just consistent'];

export interface ChatMessage {
  from: 'me' | 'tc';
  text: string;
}

export interface ChatData {
  intro: string;
  seed: ChatMessage[];
  prompts: string[];
}

export interface BeliefHistoryEntry {
  date: string;
  what: string;
  why: string;
}

export interface Belief {
  id: string;
  claim: string;
  confidence: string;
  revisedLabel: string;
  history: BeliefHistoryEntry[];
}

export interface ModelData {
  intro: string;
  beliefs: Belief[];
}

export interface ThresholdRow {
  label: string;
  value: string;
  source: string;
}

export interface DeviceRow {
  name: string;
  state: string;
  action: string;
  connected: boolean;
}

export interface ConstraintRow {
  label: string;
  value: string;
}

export interface RaceRow {
  grade: 'A' | 'B' | 'C';
  name: string;
  role: string;
  date: string;
}

export interface LearnLogEntry {
  date: string;
  what: string;
}

export interface PrefRow {
  label: string;
  value: string;
}

export interface ProfileData {
  name: string;
  initials: string;
  raceSummary: string;
  setDate: string;
  thresholds: ThresholdRow[];
  zoneBar: number[];
  devices: DeviceRow[];
  constraints: ConstraintRow[];
  races: RaceRow[];
  learnLog: LearnLogEntry[];
  learnLogTotal: string;
  prefs: PrefRow[];
  dataNote: string;
}

export interface NotifPreview {
  kind: string;
  at: string;
  title: string;
  body: string;
}

export interface NotifToggle {
  label: string;
  note: string;
  on: boolean;
}

export interface NotifTiming {
  label: string;
  value: string;
}

export interface NotificationsData {
  intro: string;
  previews: NotifPreview[];
  toggles: NotifToggle[];
  timing: NotifTiming[];
}
