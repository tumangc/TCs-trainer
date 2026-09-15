import type { CoachService } from './CoachService';
import type {
  AmendResult,
  AnalysisData,
  Belief,
  ChatData,
  ChatMessage,
  FitnessRead,
  GoalKind,
  ModelData,
  NotificationsData,
  OnboardingConstraints,
  OnboardingData,
  OnboardingFitness,
  OnboardingGoal,
  OpenQuestion,
  PlanData,
  ProfileData,
  ProgressData,
  TodayData,
} from '../types/domain';

function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const RX_FULL = [
  { label: 'Volume', value: '11.2 km · 58 min' },
  { label: 'Intensity', value: 'Z4 · 88–91% HRmax' },
  { label: 'Target HR', value: '164–171 bpm' },
  { label: 'Planned load', value: '78 TSS · wk 412' },
  { label: 'RPE ceiling', value: '7 of 10' },
];
const RX_SIMPLE = [
  { label: 'Volume', value: '11.2 km · 58 min' },
  { label: 'Effort', value: 'Comfortably hard' },
];

const AMENDS: { re: RegExp; title: string; explanation: string }[] = [
  {
    re: /40|35|30|short|time|rush/,
    title: '2 × 8 min @ 4:35/km · 42 min total',
    explanation:
      'Dropped the third rep and shortened the warm-up to 10 min. Threshold time falls from 24 to 16 min, so this week lands at 398 load instead of 412 — acceptable. The third rep was the one carrying the adaptation, so I will add it back on Saturday as a 5 km tempo finish.',
  },
  {
    re: /flat|tired|sore|heavy|rough|bad sleep/,
    title: '50 min easy @ 5:30/km',
    explanation:
      'Threshold moves to Saturday. Flat legs on the morning of a key session usually means incomplete recovery rather than lost fitness — your HRV supports that. Running it anyway would cost two days for no adaptation.',
  },
  {
    re: /tomorrow|move|later|shift|busy/,
    title: 'Thursday easy 45 min · tempo Friday 06:30',
    explanation:
      "Flipped Thursday and Friday. Saturday's long run shifts to 08:00 so you keep 22 hours between quality sessions — below that the long run degrades.",
  },
  {
    re: /treadmill|indoor|rain|track/,
    title: '3 × 8 min @ 1.5% incline, 4:40/km',
    explanation:
      'Treadmill pace adjusted 5 s/km for the missing air resistance, incline at 1.5% so the mechanics stay honest. Keep the HR window — it is the target, not the pace.',
  },
];

const DEFAULT_AMEND: AmendResult = {
  title: '3 × 8 min @ 4:35/km · unchanged',
  explanation:
    'Nothing in that changes the physiology of today, so the prescription holds. If it turns out to be more than it sounds, tell me mid-session and I will rebuild the rest of the week from what you actually ran.',
};

const QUESTIONS: (OpenQuestion & { acknowledgement: string })[] = [
  {
    id: 'q1',
    text: "Tuesday's easy run came in 9 s/km fast. Deliberate, or did it genuinely feel easy?",
    answers: ['Felt easy', 'Ran it too hard'],
    acknowledgement:
      'Noted — if it felt easy at 5:21/km your easy ceiling has moved, so I am raising easy pace to 5:25/km and will watch HR drift on Saturday before committing.',
  },
  {
    id: 'q2',
    text: "I don't have a long-run window for Saturday. Confirm 07:00 or later?",
    answers: ['07:00', '09:30', 'Sunday instead'],
    acknowledgement:
      "Saturday 07:00 locked. That keeps 22 hours from today's threshold work, which is the minimum I plan around.",
  },
];

const ANALYSES: Record<string, AnalysisData> = {
  'tue-24-feb': {
    id: 'tue-24-feb',
    dateLabel: 'Tue 24 Feb · 06:48 · analysed 07:41',
    title: 'Easy 8 km',
    duration: '44:12',
    verdictTag: '9 s/km fast',
    verdictHeadline: 'You ran an easy run at the top of easy — and your body did not mind.',
    stats: [
      { label: 'Avg pace', value: '5:21 /km', highlight: true },
      { label: 'Prescribed', value: '5:30 /km' },
      { label: 'Avg HR', value: '147 bpm' },
      { label: 'HR drift', value: '1.4%', highlight: true },
      { label: 'Load', value: '46 · planned 42' },
      { label: 'Cadence', value: '178 spm' },
    ],
    paceHr: {
      pace: [74, 70, 52, 48, 50, 62, 66, 58, 44, 40, 42, 46, 52, 56, 58, 60].map((y) => 1 - y / 110),
      hr: [96, 88, 80, 76, 74, 70, 66, 64, 68, 66, 64, 66, 68, 70, 70, 72].map((y) => 1 - y / 110),
      pinnedIndices: [0, 2, 9],
    },
    notesPinned: 3,
    timeline: [
      {
        at: '0:00',
        label: 'Warm-up, first 1.5 km',
        metric: '5:34 · 138',
        note: 'You started this one right — 5:34 for the opening kilometre is exactly the ceiling I asked for.',
      },
      {
        at: '8:12',
        label: 'Km 2–4, flat river path',
        metric: '5:21 · 146',
        note: 'Pace stepped up 13 s/km here and never came back down. HR followed within a minute, so this was effort, not a downhill.',
      },
      { at: '22:40', label: 'Climb out of the park', metric: '5:40 · 152' },
      {
        at: '26:05',
        label: 'Km 6–7, fastest stretch',
        metric: '5:18 · 149',
        note: 'Drift across this stretch is 1.4% — barely measurable. That is the reading that makes me doubt my own easy-pace ceiling rather than your discipline.',
      },
      { at: '38:20', label: 'Cool-down to the door', metric: '5:26 · 147' },
    ],
    whatThisChanges: [
      "Nothing in today's threshold session — the load cost of 46 against 42 planned is inside tolerance.",
      'It moves "you run easy days too hard" from a belief toward a question, which is why I asked you about it on Today.',
      "If you tell me it felt easy, easy pace becomes 5:25/km and Saturday's long run gets 4 s/km faster.",
    ],
  },
};

const CHAT_SEED: ChatMessage[] = [
  {
    from: 'tc',
    text: "Morning. Threshold 3 × 8 min at 4:35/km is on your Today screen — HRV is +4 on baseline, so I kept the full session.",
  },
  { from: 'me', text: 'Why 8 minute reps and not 5 × 5?' },
  {
    from: 'tc',
    text: "Because your third rep is where you fade, not your first. Shorter reps would let you hold pace and learn nothing. Eight minutes puts you under sustained strain at a pace you can actually keep, which is the specific demand of a half marathon.\n\nIf you'd rather have 5 × 5, say so — it costs about 4 minutes of threshold time and I'd add them back Saturday.",
  },
];

const CHAT_TABLE: { re: RegExp; a: string }[] = [
  {
    re: /easy|slow|too hard|pace ceiling/,
    a: 'Your last four easy runs averaged 5:21/km against a 5:30 prescription, and heart-rate drift across them was 1.4%. That is not overreaching — that is a ceiling I set too low from an old 10 km. Tell me it felt easy and I will move easy pace to 5:25/km.',
  },
  {
    re: /goal|1:29|time|predict|realistic/,
    a: '1:29:30 is live. Your own threshold curve puts you at 1:28:58 today, and you crossed the goal line in week 6 of this block. The risk is not fitness, it is the last two weeks — most people I plan for lose 20 seconds by over-running the taper.',
  },
  {
    re: /skip|miss|holiday|travel|sick/,
    a: 'One missed session costs you almost nothing; I rebuild the week around it. Three in a row and I shorten the peak phase rather than compress it, because compressed peaks are where injuries come from. Tell me the dates and I will show you both versions.',
  },
  {
    re: /injur|pain|hurt|niggle|knee|achilles/,
    a: 'Stop the session and tell me where. I will drop intensity for 72 hours and replace threshold with cross-training you already do, then bring load back at 70%. I do not diagnose — if it is sharp or it changes your gait, that is a physio, not me.',
  },
  {
    re: /long run|saturday|18 km/,
    a: 'Saturday is 18 km at 5:25/km with no fast finish, 112 load. It sits 48 hours after today deliberately. If today\'s session goes badly I will cut it to 15 km — the long run is the session I protect last, not first.',
  },
  {
    re: /taper|race week|race day/,
    a: "Two weeks: volume drops 35% then 55%, intensity stays. You will feel sluggish in the first taper week — that is normal and I will remind you when it happens so you don't panic and add a session.",
  },
];

const DEFAULT_CHAT_REPLY =
  "I can answer that better with one more data point — run Saturday as prescribed and ask me again Sunday. Everything I say is inferred from your own runs, so when I don't have the evidence I would rather say so than invent a number.";

const BELIEFS: Belief[] = [
  {
    id: 'threshold-pace',
    claim: 'Your threshold sits at 4:35/km, held for 24 minutes.',
    confidence: 'High confidence',
    revisedLabel: 'Revised 18 Feb',
    history: [
      { date: '18 Feb', what: 'Raised from 4:41 to 4:35/km.', why: 'Three sessions at 4:36–4:38 with HR under 169 and decoupling below 4%.' },
      { date: '6 Jan', what: 'Raised from 4:47 to 4:41/km.', why: 'Week 5 tempo held 4:43 at the same HR as week 1 held 4:52.' },
      { date: '2 Dec', what: 'First estimate: 4:47/km.', why: 'Taken from the 41:59 10K you entered at setup.' },
    ],
  },
  {
    id: 'third-rep',
    claim: 'Your third rep is the limiter, not your top-end speed.',
    confidence: 'High confidence',
    revisedLabel: 'Revised 12 Feb',
    history: [
      {
        date: '12 Feb',
        what: 'Confirmed across four blocks.',
        why: 'Rep 3 pace falls 5–7 s/km while HR keeps climbing; reps 1–2 are stable. Duration work outranks pace work for you.',
      },
      { date: '14 Jan', what: 'First noticed.', why: 'Two consecutive tempo sessions faded in the final rep only.' },
    ],
  },
  {
    id: 'recovery-window',
    claim: 'You recover fully in 48 hours after threshold work.',
    confidence: 'Medium confidence',
    revisedLabel: 'Revised 26 Feb',
    history: [
      {
        date: '26 Feb',
        what: 'Downgraded to medium.',
        why: 'Two of the last five 48-hour windows came back with HRV still below baseline. Travel is the common factor and I cannot see your calendar.',
      },
      { date: '9 Jan', what: 'Set at 48 hours.', why: 'HRV returned to baseline within two days on six of six occasions.' },
    ],
  },
  {
    id: 'easy-day-effort',
    claim: 'You run easy days too hard when you feel good.',
    confidence: 'Low confidence — needs your input',
    revisedLabel: 'Open question',
    history: [
      {
        date: '26 Feb',
        what: 'Flagged, not yet a belief.',
        why: 'Three easy runs this block landed 8–11 s/km faster than prescribed. I do not know whether that is discipline or a moved easy ceiling — that is the question on your Today screen.',
      },
    ],
  },
];

const NOTIF_TOGGLE_DEFS: { label: string; note: string }[] = [
  { label: 'Morning brief', note: "The day's prescription, before you get up" },
  { label: 'Plan changes', note: 'Only when TC rewrites something you were expecting' },
  { label: 'Analysis ready', note: 'When a run has something worth reading' },
  { label: "TC's questions", note: 'When an answer would change the plan' },
  { label: 'Weekly review', note: 'Sunday evening summary' },
];

const DEFAULT_FITNESS_READS: FitnessRead[] = [
  { label: 'Threshold pace', value: '4:47 /km', confidence: 'Low' },
  { label: 'Sustainable weekly load', value: '≈ 310', confidence: 'Medium' },
  { label: 'Safe ramp rate', value: '+6% /wk', confidence: 'Medium' },
  { label: 'Predicted half today', value: '1:33:40', confidence: 'Low' },
];

export class MockCoachService implements CoachService {
  private sentToWatch = false;
  private notifToggles: Record<string, boolean> = Object.fromEntries(NOTIF_TOGGLE_DEFS.map((t) => [t.label, true]));
  private goalKind: GoalKind = 'Race';
  private race = 'Rotterdam Half Marathon';
  private date = '12 April 2026';
  private goalTime = '1:29:30';
  private offDays = ['Mon'];
  private timeCap = '60 min';
  private cross = ['Strength'];
  private recurring = 'Club session Tuesday 19:00';
  private recentRaceDist = '10 km';
  private recentRaceTime = '41:59';
  private weeklyKm = '38';
  private yearsRunning = '6';

  async getToday(): Promise<TodayData> {
    return delay(
      {
        dateLabel: 'Thu 26 Feb · wk 7/14 · build',
        sessionLabel: 'Session 41',
        prescription: {
          kicker: 'Prescription · threshold',
          revisedTag: 'Revised 06:10',
          title: '3 × 8 min @ 4:35/km',
          subtitle: '3 min float · 15 min w/u · 10 min c/d',
          rowsFull: RX_FULL,
          rowsSimple: RX_SIMPLE,
          sentToWatch: this.sentToWatch,
        },
        basis: [
          { value: 'HRV 62 ms', note: '+4 on your 30-day baseline' },
          { value: 'Sleep 7:12', note: '88% efficiency, two wakings' },
          { value: '48 h', note: 'since last quality session' },
        ],
        basisExplainer:
          'Recovery markers are within range, so interval duration is unchanged. Principle: progressive overload at threshold — your third rep is the limiter, so this holds duration rather than raising pace. Against your own week 3, that\'s +2 min at threshold.',
        openQuestions: QUESTIONS.map(({ id, text, answers }) => ({ id, text, answers })),
        questionsScope: 'Affects Saturday',
      },
      120,
    );
  }

  async sendPrescriptionToWatch(): Promise<void> {
    this.sentToWatch = true;
    return delay(undefined, 200);
  }

  async submitAmend(freeText: string): Promise<AmendResult> {
    const q = freeText.toLowerCase();
    const match = AMENDS.find((a) => a.re.test(q));
    return delay(match ? { title: match.title, explanation: match.explanation } : DEFAULT_AMEND, 1000);
  }

  async answerQuestion(questionId: string): Promise<{ acknowledgement: string }> {
    const q = QUESTIONS.find((item) => item.id === questionId);
    return delay({ acknowledgement: q?.acknowledgement ?? '' }, 150);
  }

  async getPlan(): Promise<PlanData> {
    return delay(
      {
        block: {
          raceLabel: 'Block · Rotterdam Half',
          weekLabel: 'Week 7 of 14',
          daysOut: 49,
          phases: [
            { label: 'Base', weeks: '1–4', fraction: 4 / 14, state: 'done' },
            { label: 'Build', weeks: '5–9', fraction: 5 / 14, state: 'current' },
            { label: 'Peak', weeks: '10–12', fraction: 3 / 14, state: 'upcoming' },
            { label: 'Taper', weeks: '13–14', fraction: 2 / 14, state: 'upcoming' },
          ],
          weeklyLoad: {
            value: 412,
            deltaPct: 6,
            bars: [26, 32, 28, 38, 42, 36, 48, 52, 56, 60, 54, 50, 32, 20].map((h) => h / 60),
            currentIndex: 6,
          },
          keySessionsRemaining: 11,
          keySessions: [
            { title: 'Threshold 4 × 8 min', when: 'wk 8' },
            { title: '15 km tune-up race', when: 'wk 10', highlighted: true },
            { title: 'Half-pace 3 × 5 km', when: 'wk 11' },
          ],
        },
        changeNotice: {
          message: "Wednesday's intervals became a recovery run — you flew Tuesday night and slept 5:40.",
        },
        weekSummary: 'This week · 52 km · 412 load',
        sessions: [
          { id: 'mon', day: 'Mon', title: 'Rest', detail: 'Mobility 15 min', status: 'Logged', load: null, emphasis: 'neutral' },
          {
            id: 'tue',
            day: 'Tue',
            title: 'Easy 8 km',
            detail: 'Ran 5:21/km · analysis ready ›',
            status: 'Fast',
            load: 46,
            emphasis: 'accent-dim',
            analysisId: 'tue-24-feb',
          },
          { id: 'wed', day: 'Wed', title: 'Recovery 10 km', detail: 'Rewritten from intervals', status: 'Logged', load: 52, emphasis: 'neutral' },
          { id: 'thu', day: 'Thu', title: 'Threshold 3 × 8 min', detail: '4:35/km · 11.2 km', status: 'Today', load: 78, emphasis: 'accent' },
          { id: 'fri', day: 'Fri', title: 'Easy 45 min', detail: '5:30/km', status: 'Planned', load: 38, emphasis: 'neutral' },
          { id: 'sat', day: 'Sat', title: 'Long run 18 km', detail: '5:25/km, no fast finish', status: 'Planned', load: 112, emphasis: 'accent-dim' },
          { id: 'sun', day: 'Sun', title: 'Easy 6 km', detail: 'Optional shake-out', status: 'Planned', load: 28, emphasis: 'neutral' },
        ],
      },
      120,
    );
  }

  async dismissPlanChange(): Promise<void> {
    return delay(undefined, 100);
  }

  async getProgress(): Promise<ProgressData> {
    return delay(
      {
        sinceLabel: 'Since 2 December · 12 weeks',
        loadForm: {
          ctl: 58,
          atl: 51,
          tsb: 7,
          fitness: [96, 92, 86, 84, 74, 70, 58, 56, 44, 38, 30, 24].map((y) => 1 - y / 120),
          fatigue: [104, 98, 100, 90, 94, 82, 86, 72, 78, 62, 70, 40].map((y) => 1 - y / 120),
          note: 'Fitness has risen every week of this block; fatigue spiked Tuesday and is still elevated. Form at +7 is where I want you before a key session.',
        },
        racePrediction: {
          raceLabel: 'half',
          current: '1:28:58',
          goal: '1:29:30',
          goalLine: 1 - 46 / 96,
          crossedWeekLabel: 'Crossed the goal line in week 6',
          series: [86, 84, 78, 74, 70, 64, 60, 56, 52, 48, 44, 38].map((y) => 1 - y / 96),
          note: 'Prediction from your own threshold curve, not a population table.',
        },
        weeklyVolume: {
          series: [36, 42, 30, 48, 52, 38, 58, 64, 46, 68, 72, 76].map((h) => h / 78),
          sinceLabel: '12 wks ago',
          currentLabel: '52 km this week',
        },
        bests: [
          { distance: '5 km', time: '19:44', delta: '−22 s' },
          { distance: '10 km', time: '41:08', delta: '−51 s' },
          { distance: 'Half', time: '1:31:12', delta: 'Sept, pre-block' },
        ],
      },
      120,
    );
  }

  async getRunAnalysis(id: string): Promise<AnalysisData> {
    const data = ANALYSES[id];
    if (!data) throw new Error(`No analysis for run "${id}"`);
    return delay(data, 120);
  }

  async getOnboarding(): Promise<OnboardingData> {
    return delay(
      {
        goal: this.goalFor(this.goalKind),
        constraints: this.constraintsFor(this.offDays, this.timeCap, this.cross),
        fitness: this.fitnessSnapshot(),
        preview: {
          phases: [
            { label: 'Base', weeks: '1–4', fraction: 4 / 14, state: 'current' },
            { label: 'Build', weeks: '5–9', fraction: 5 / 14, state: 'upcoming' },
            { label: 'Peak', weeks: '10–12', fraction: 3 / 14, state: 'upcoming' },
            { label: 'Taper', weeks: '13–14', fraction: 2 / 14, state: 'upcoming' },
          ],
          week: [
            { day: 'Mon', title: 'Rest', meta: 'unavailable', highlighted: false },
            { day: 'Tue', title: 'Club session — easy 8 km', meta: '19:00', highlighted: false },
            { day: 'Wed', title: 'Rest or strength', meta: '30 min', highlighted: false },
            { day: 'Thu', title: 'Threshold 4 × 6 min', meta: '55 min', highlighted: true },
            { day: 'Fri', title: 'Easy 6 km', meta: '35 min', highlighted: false },
            { day: 'Sat', title: 'Long run 14 km', meta: '07:00', highlighted: true },
            { day: 'Sun', title: 'Optional shake-out', meta: '25 min', highlighted: false },
          ],
          guesses: [
            'Your threshold is estimated from one 10 km — expect me to revise it inside three weeks.',
            "I don't know how you recover yet, so week 1 is deliberately conservative.",
            'Connect a watch whenever you like; without it I plan on your feedback alone.',
          ],
        },
      },
      120,
    );
  }

  async setOnboardingGoalKind(kind: GoalKind): Promise<OnboardingGoal> {
    this.goalKind = kind;
    return delay(this.goalFor(kind), 80);
  }

  async updateOnboardingGoal(patch: Partial<Pick<OnboardingGoal, 'race' | 'date' | 'goalTime'>>): Promise<OnboardingGoal> {
    if (patch.race !== undefined) this.race = patch.race;
    if (patch.date !== undefined) this.date = patch.date;
    if (patch.goalTime !== undefined) this.goalTime = patch.goalTime;
    return delay(this.goalFor(this.goalKind), 80);
  }

  async updateOnboardingConstraints(
    patch: Partial<Pick<OnboardingConstraints, 'offDays' | 'timeCap' | 'cross' | 'recurring'>>,
  ): Promise<OnboardingConstraints> {
    if (patch.offDays) this.offDays = patch.offDays;
    if (patch.timeCap) this.timeCap = patch.timeCap;
    if (patch.cross) this.cross = patch.cross;
    if (patch.recurring !== undefined) this.recurring = patch.recurring;
    return delay(this.constraintsFor(this.offDays, this.timeCap, this.cross), 80);
  }

  async updateOnboardingFitness(
    patch: Partial<Pick<OnboardingFitness, 'recentRaceDist' | 'recentRaceTime' | 'weeklyKm' | 'yearsRunning'>>,
  ): Promise<OnboardingFitness> {
    if (patch.recentRaceDist !== undefined) this.recentRaceDist = patch.recentRaceDist;
    if (patch.recentRaceTime !== undefined) this.recentRaceTime = patch.recentRaceTime;
    if (patch.weeklyKm !== undefined) this.weeklyKm = patch.weeklyKm;
    if (patch.yearsRunning !== undefined) this.yearsRunning = patch.yearsRunning;
    return delay(this.fitnessSnapshot(), 80);
  }

  async importFitnessFromWatch(): Promise<OnboardingFitness> {
    this.recentRaceDist = '18 months of watch history';
    this.recentRaceTime = 'imported';
    this.weeklyKm = '41';
    this.yearsRunning = '6';
    return delay(
      {
        recentRaceDist: this.recentRaceDist,
        recentRaceTime: this.recentRaceTime,
        weeklyKm: this.weeklyKm,
        yearsRunning: this.yearsRunning,
        reads: [
          { label: 'Threshold pace', value: '4:44 /km', confidence: 'Medium' },
          { label: 'Sustainable weekly load', value: '≈ 340', confidence: 'Medium' },
          { label: 'Safe ramp rate', value: '+7% /wk', confidence: 'High' },
          { label: 'Predicted half today', value: '1:32:10', confidence: 'Medium' },
        ],
      },
      600,
    );
  }

  async completeOnboarding(): Promise<void> {
    return delay(undefined, 150);
  }

  async getChat(): Promise<ChatData> {
    return delay(
      {
        intro:
          "TC can see every run you have logged, this block's plan and its own reasoning. Ask it why, or tell it what changed.",
        seed: CHAT_SEED,
        prompts: ['Am I running easy days too hard?', 'Is 1:29:30 still realistic?', 'What if I miss next week?', 'Why this long run?'],
      },
      120,
    );
  }

  async sendChatMessage(text: string): Promise<{ reply: string }> {
    const q = text.toLowerCase();
    const match = CHAT_TABLE.find((c) => c.re.test(q));
    return delay({ reply: match ? match.a : DEFAULT_CHAT_REPLY }, 1100);
  }

  async getModel(): Promise<ModelData> {
    return delay(
      {
        intro: 'Every belief below is inferred from your own runs. Tap one to see when it changed and what changed it.',
        beliefs: BELIEFS,
      },
      120,
    );
  }

  async getProfile(): Promise<ProfileData> {
    return delay(
      {
        name: 'Mara Kessler',
        initials: 'MK',
        raceSummary: 'Rotterdam Half · 12 April · 49 days out',
        setDate: '18 Feb',
        thresholds: [
          { label: 'Threshold pace', value: '4:35 /km', source: 'Inferred' },
          { label: 'Threshold HR', value: '171 bpm', source: 'Inferred' },
          { label: 'Max HR seen', value: '189 bpm', source: 'Measured' },
          { label: 'Easy ceiling', value: '5:30 /km', source: 'In review' },
          { label: 'Resting HR / HRV', value: '44 · 58 ms', source: '30-day' },
        ],
        zoneBar: [5, 4, 3, 2, 1],
        devices: [
          { name: 'Garmin Forerunner 965', state: 'Synced 07:12 · workouts push to watch', action: 'Manage', connected: true },
          { name: 'Strava', state: 'Not connected', action: 'Connect', connected: false },
          { name: 'Apple Health', state: 'Sleep and HRV only · not connected', action: 'Connect', connected: false },
        ],
        constraints: [
          { label: "Can't run", value: 'Mondays' },
          { label: 'Max on a weekday', value: '60 min' },
          { label: 'Long run', value: 'Saturday, 07:00' },
          { label: 'Cross-training counted', value: 'Strength ×2' },
          { label: 'Recurring', value: 'Club session Tue 19:00' },
        ],
        races: [
          { grade: 'A', name: 'Rotterdam Half Marathon', role: 'Goal 1:29:30 · this block points here', date: '12 Apr' },
          { grade: 'B', name: 'Zuiderpark 15 km', role: 'Tune-up · run at half effort', date: '22 Mar' },
          { grade: 'C', name: 'Club 10 km time trial', role: 'Optional · TC will fold it into a week', date: '17 May' },
        ],
        learnLog: [
          { date: '26 Feb', what: 'Downgraded 48-hour recovery to medium confidence after two slow rebounds.' },
          { date: '18 Feb', what: 'Raised threshold pace from 4:41 to 4:35/km.' },
          { date: '12 Feb', what: 'Confirmed rep three is your limiter, so duration work outranks pace work.' },
        ],
        learnLogTotal: '4 changes this block',
        prefs: [
          { label: 'Units', value: 'Kilometres' },
          { label: 'Pace shown as', value: 'min / km' },
          { label: 'Week starts', value: 'Monday' },
          { label: 'Default detail', value: 'Full' },
        ],
        dataNote: "Your runs train your plan and nothing else. TC's model of you is not shared, sold or pooled with other runners.",
      },
      120,
    );
  }

  async getNotifications(): Promise<NotificationsData> {
    return delay(
      {
        intro: 'Five kinds, no streaks and no nagging. TC only pings you when the plan changed or it needs an answer.',
        previews: [
          { kind: 'Morning brief', at: '06:10', title: 'Threshold 3 × 8 min at 4:35/km', body: 'HRV +4 on baseline and you slept 7:12 — full session stands.' },
          {
            kind: 'Plan changed',
            at: 'Wed 05:58',
            title: "Wednesday's intervals are now a recovery run",
            body: 'You flew Tuesday night and slept 5:40. The intervals move to Thursday.',
          },
          {
            kind: 'Analysis ready',
            at: 'Tue 07:41',
            title: 'Tuesday easy 8 km — 9 s/km fast, drift 1.4%',
            body: 'Worth a look: this one is making me question your easy ceiling.',
          },
          { kind: 'Question', at: 'Tue 08:05', title: 'Did that run feel easy, or did you push it?', body: "Your answer decides whether Saturday gets faster." },
          {
            kind: 'Weekly review',
            at: 'Sun 19:00',
            title: 'Week 6: 52 km, every session completed',
            body: 'Fitness up 4, form +7. Next week is the biggest of the block.',
          },
        ],
        toggles: NOTIF_TOGGLE_DEFS.map((t) => ({ ...t, on: this.notifToggles[t.label] })),
        timing: [
          { label: 'Morning brief at', value: '06:10' },
          { label: 'Quiet hours', value: '21:30 – 05:45' },
          { label: 'Weekly review', value: 'Sunday 19:00' },
        ],
      },
      120,
    );
  }

  async setNotificationToggle(label: string, on: boolean): Promise<void> {
    this.notifToggles[label] = on;
    return delay(undefined, 80);
  }

  private goalFor(kind: GoalKind): OnboardingGoal {
    const note =
      kind === 'Race'
        ? '14 weeks out. That is enough for a full base, build and peak with two weeks of taper — no compression needed.'
        : kind === 'Distance goal'
          ? 'No date means no taper to plan, so I will run rolling four-week cycles and hold you at the same load until you tell me otherwise.'
          : 'Then I will keep you honest rather than fast: three or four easy runs a week, one of them slightly harder, and I will not ramp you past 8% a week.';
    return { kind, race: this.race, date: this.date, goalTime: this.goalTime, note };
  }

  private constraintsFor(offDays: string[], timeCap: string, cross: string[]): OnboardingConstraints {
    const note =
      offDays.length > 2
        ? `With ${offDays.length} days out I will drop to three runs a week and make each one count rather than pretend you can fit four.`
        : 'Four runs a week fits that. Your long run goes Saturday, quality Thursday, and I will keep Tuesday easy so your club session stays yours.';
    return { offDays, timeCap, cross, recurring: this.recurring, note };
  }

  private fitnessSnapshot(): OnboardingFitness {
    return {
      recentRaceDist: this.recentRaceDist,
      recentRaceTime: this.recentRaceTime,
      weeklyKm: this.weeklyKm,
      yearsRunning: this.yearsRunning,
      reads: DEFAULT_FITNESS_READS,
    };
  }
}
