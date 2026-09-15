import type { ReactNode } from 'react';
import { Bell, Calendar, ChartBar, ChatCircleText, Circle, Sparkle } from '@phosphor-icons/react';
import type { MainTab, Screen } from '../../types/nav';

const NAV_ITEMS: { tab: MainTab; label: string; icon: typeof Circle }[] = [
  { tab: 'today', label: 'Today', icon: Circle },
  { tab: 'plan', label: 'Plan', icon: Calendar },
  { tab: 'progress', label: 'Progress', icon: ChartBar },
  { tab: 'chat', label: 'TC', icon: ChatCircleText },
  { tab: 'model', label: 'Model', icon: Sparkle },
];

export function AppShell({
  screen,
  onNavigate,
  onOpenNotifs,
  onOpenProfile,
  initials = 'MK',
  children,
}: {
  screen: Screen;
  onNavigate: (tab: MainTab) => void;
  onOpenNotifs: () => void;
  onOpenProfile: () => void;
  initials?: string;
  children: ReactNode;
}) {
  const showChrome = screen !== 'onboarding' && screen !== 'notifs';
  const showNav = screen !== 'onboarding';

  return (
    <div className="app-shell">
      {showChrome && (
        <div className="top-chrome">
          <button type="button" className="chrome-btn" onClick={onOpenNotifs} aria-label="Notifications">
            <Bell size={16} weight="regular" />
            <span className="chrome-dot" />
          </button>
          <button
            type="button"
            className={`chrome-btn chrome-avatar${screen === 'profile' ? ' chrome-avatar--active' : ''}`}
            onClick={onOpenProfile}
            aria-label="Profile"
          >
            {initials}
          </button>
        </div>
      )}

      <div className={`app-scroll${showChrome ? ' app-scroll--with-chrome' : ''}${showNav ? '' : ' app-scroll--no-nav'}`}>
        {children}
      </div>

      {showNav && (
        <div className="bottom-nav">
          {NAV_ITEMS.map(({ tab, label, icon: Icon }) => {
            const active = screen === tab;
            return (
              <button
                key={tab}
                type="button"
                className={`nav-btn${active ? ' nav-btn--active' : ''}`}
                onClick={() => onNavigate(tab)}
              >
                <Icon size={22} weight={active ? 'fill' : 'regular'} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
