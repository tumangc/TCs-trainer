import { useState } from 'react';
import { AppShell } from './components/shell/AppShell';
import { TodayScreen } from './screens/TodayScreen';
import { PlanScreen } from './screens/PlanScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { AnalysisScreen } from './screens/AnalysisScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ChatScreen } from './screens/ChatScreen';
import { ModelScreen } from './screens/ModelScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { CoachServiceProvider } from './services/ServiceContext';
import { useDensity } from './hooks/useDensity';
import type { MainTab, Screen } from './types/nav';

function AppInner() {
  const [onboarded, setOnboarded] = useState(false);
  const [screen, setScreen] = useState<Screen>('today');
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const { isFull, setDensity } = useDensity();

  if (!onboarded) {
    return (
      <div className="app-shell">
        <div className="app-scroll app-scroll--no-nav">
          <OnboardingScreen
            onComplete={() => {
              setOnboarded(true);
              setScreen('today');
            }}
          />
        </div>
      </div>
    );
  }

  const goto = (tab: MainTab) => setScreen(tab);
  const openAnalysis = (id: string) => {
    setAnalysisId(id);
    setScreen('analysis');
  };

  return (
    <AppShell screen={screen} onNavigate={goto} onOpenNotifs={() => setScreen('notifs')} onOpenProfile={() => setScreen('profile')}>
      {screen === 'today' && (
        <TodayScreen isFull={isFull} onSetDensity={(full) => setDensity(full ? 'full' : 'simple')} />
      )}
      {screen === 'plan' && <PlanScreen onOpenAnalysis={openAnalysis} />}
      {screen === 'progress' && <ProgressScreen />}
      {screen === 'analysis' && analysisId && (
        <AnalysisScreen id={analysisId} onBack={() => setScreen('plan')} onAskTc={() => setScreen('chat')} />
      )}
      {screen === 'chat' && <ChatScreen />}
      {screen === 'model' && <ModelScreen />}
      {screen === 'profile' && (
        <ProfileScreen isFull={isFull} onOpenModel={() => setScreen('model')} onOpenNotifs={() => setScreen('notifs')} />
      )}
      {screen === 'notifs' && <NotificationsScreen onBack={() => setScreen('profile')} />}
    </AppShell>
  );
}

export default function App() {
  return (
    <CoachServiceProvider>
      <AppInner />
    </CoachServiceProvider>
  );
}
