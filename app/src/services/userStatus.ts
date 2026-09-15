export async function getHasCompletedOnboarding(): Promise<boolean> {
  try {
    const res = await fetch('/api/user');
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.hasCompletedOnboarding);
  } catch {
    return false;
  }
}

/** Wipes the persisted profile and disconnects Strava — back to a fresh install. */
export async function resetAllData(): Promise<void> {
  await fetch('/api/user', { method: 'DELETE' });
}
