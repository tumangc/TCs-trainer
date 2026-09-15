import { createContext, useContext } from 'react';
import type { CoachService } from './CoachService';
import { MockCoachService } from './mockCoachService';

export const defaultService = new MockCoachService();
export const CoachServiceContext = createContext<CoachService>(defaultService);

export function useCoachService(): CoachService {
  return useContext(CoachServiceContext);
}
