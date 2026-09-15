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
