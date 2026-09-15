import { useCallback, useState } from 'react';
import type { Density } from '../types/domain';

const STORAGE_KEY = 'tct.density';

function readStored(): Density | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'simple' || saved === 'full' ? saved : null;
  } catch {
    return null;
  }
}

export function useDensity(defaultDensity: Density = 'full') {
  const [density, setDensityState] = useState<Density>(() => readStored() ?? defaultDensity);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable — density just won't persist
    }
  }, []);

  return { density, setDensity, isFull: density === 'full' };
}
