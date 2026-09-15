import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const USER_PATH = path.join(DATA_DIR, 'user.json');

// Single-user prototype: one JSON file is the whole "database". No accounts,
// no auth — whoever is running the server is "the" user.
const DEFAULT_USER = {
  hasCompletedOnboarding: false,
  onboarding: {
    goalKind: 'Race',
    race: 'Rotterdam Half Marathon',
    date: '12 April 2026',
    goalTime: '1:29:30',
    offDays: ['Mon'],
    timeCap: '60 min',
    cross: ['Strength'],
    recurring: 'Club session Tuesday 19:00',
    recentRaceDist: '10 km',
    recentRaceTime: '41:59',
    weeklyKm: '38',
    yearsRunning: '6',
  },
};

export function getUser() {
  if (!existsSync(USER_PATH)) return structuredClone(DEFAULT_USER);
  try {
    const stored = JSON.parse(readFileSync(USER_PATH, 'utf-8'));
    return {
      ...structuredClone(DEFAULT_USER),
      ...stored,
      onboarding: { ...DEFAULT_USER.onboarding, ...stored.onboarding },
    };
  } catch {
    return structuredClone(DEFAULT_USER);
  }
}

export function updateUser(patch) {
  const current = getUser();
  const next = {
    ...current,
    ...patch,
    onboarding: { ...current.onboarding, ...patch.onboarding },
  };
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(USER_PATH, JSON.stringify(next, null, 2));
  return next;
}

export function resetUser() {
  if (existsSync(USER_PATH)) rmSync(USER_PATH);
  return structuredClone(DEFAULT_USER);
}
