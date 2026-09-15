import { createContext, useContext } from 'react';
import type { CoachService } from './CoachService';
import { LiveCoachService } from './liveCoachService';

export const defaultService = new LiveCoachService();
export const CoachServiceContext = createContext<CoachService>(defaultService);

export function useCoachService(): CoachService {
  return useContext(CoachServiceContext);
}
