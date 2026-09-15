import type { Belief, PlanData, TodayData } from '../types/domain';

export interface StravaStatus {
  connected: boolean;
  athlete?: { id: number; name: string } | null;
}

export interface StravaTestResult {
  ok: boolean;
  athlete?: { id: number; name: string };
  recentActivities?: Array<{
    id: number;
    name: string;
    type: string;
    distanceMeters: number;
    movingTimeSeconds: number;
    startDate: string;
  }>;
  error?: string;
  message?: string;
}

export async function getStravaStatus(): Promise<StravaStatus> {
  const res = await fetch('/api/strava/status');
  if (!res.ok) return { connected: false };
  return res.json();
}

export function stravaConnectUrl(): string {
  return '/api/strava/connect';
}

export async function disconnectStrava(): Promise<void> {
  await fetch('/api/strava/disconnect', { method: 'POST' });
}

export async function testStravaConnection(): Promise<StravaTestResult> {
  const res = await fetch('/api/strava/test');
  const body = await res.json();
  return body;
}

export interface StravaFitnessImport {
  ok: boolean;
  fitness?: { recentRaceDist: string; recentRaceTime: string; weeklyKm: string; yearsRunning: string };
  error?: string;
  message?: string;
}

export async function importFitnessFromStrava(): Promise<StravaFitnessImport> {
  const res = await fetch('/api/strava/fitness');
  return res.json();
}

export interface StravaInsights {
  ok: boolean;
  beliefs?: Belief[];
  thresholdPace?: string | null;
  maxHr?: number | null;
  error?: string;
  message?: string;
}

export async function getStravaInsights(): Promise<StravaInsights> {
  const res = await fetch('/api/strava/insights');
  return res.json();
}

export type StravaTodayResult = ({ ok: true } & TodayData) | { ok: false; error: string };
export type StravaPlanResult = ({ ok: true } & PlanData) | { ok: false; error: string };

export async function getStravaToday(): Promise<StravaTodayResult> {
  const res = await fetch('/api/strava/today');
  return res.json();
}

export async function getStravaPlan(): Promise<StravaPlanResult> {
  const res = await fetch('/api/strava/plan');
  return res.json();
}
