import type { ReactNode } from 'react';
import type { CoachService } from './CoachService';
import { CoachServiceContext, defaultService } from './coachServiceContext';

export function CoachServiceProvider({
  service,
  children,
}: {
  service?: CoachService;
  children: ReactNode;
}) {
  return (
    <CoachServiceContext.Provider value={service ?? defaultService}>
      {children}
    </CoachServiceContext.Provider>
  );
}
