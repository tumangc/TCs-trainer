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
