import {
  LayoutDashboard,
  ClipboardList,
  Flame,
  CalendarDays,
  BarChart3,
  Wallet,
  Settings as SettingsIcon,
  PlusCircle,
} from 'lucide-react';

export type NavTab = 'dashboard' | 'plans' | 'trades' | 'calendar' | 'analytics' | 'accounts' | 'settings';

interface NavigationProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenNewPlan: () => void;
  plansCount?: number;
  activeTradesCount?: number;
}

export function Navigation({
  currentTab,
  onSelectTab,
  onOpenNewPlan,
  plansCount = 0,
  activeTradesCount = 0,
}: NavigationProps) {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'plans' as NavTab, label: 'Plans', icon: ClipboardList, badge: plansCount > 0 ? plansCount : undefined },
    { id: 'trades' as NavTab, label: 'Trades', icon: Flame, badge: activeTradesCount > 0 ? activeTradesCount : undefined },
    { id: 'calendar' as NavTab, label: 'Calendar', icon: CalendarDays },
    { id: 'analytics' as NavTab, label: 'Analytics', icon: BarChart3 },
    { id: 'accounts' as NavTab, label: 'Accounts', icon: Wallet },
    { id: 'settings' as NavTab, label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <>
      {/* Desktop Subheader Navigation Bar */}
      <nav className="hidden md:block bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-1 overflow-x-auto py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-950' : 'text-zinc-400'}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-zinc-300 text-zinc-950' : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 px-2 py-1.5 flex items-center justify-around shadow-lg">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
            currentTab === 'dashboard' ? 'text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" />
          <span>Home</span>
        </button>

        <button
          onClick={() => onSelectTab('plans')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors relative ${
            currentTab === 'plans' ? 'text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          <ClipboardList className="w-4 h-4 mb-0.5" />
          <span>Plans</span>
          {plansCount > 0 && (
            <span className="absolute top-0 right-1 w-2 h-2 rounded-full bg-sky-500" />
          )}
        </button>

        {/* Center Mobile + Button */}
        <button
          onClick={onOpenNewPlan}
          className="flex flex-col items-center justify-center -mt-4 w-11 h-11 rounded-full bg-zinc-100 text-zinc-950 shadow-md border border-zinc-200 active:scale-95 transition-transform"
          aria-label="Create New Plan"
        >
          <PlusCircle className="w-6 h-6 stroke-[2.2]" />
        </button>

        <button
          onClick={() => onSelectTab('trades')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors relative ${
            currentTab === 'trades' ? 'text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          <Flame className="w-4 h-4 mb-0.5" />
          <span>Trades</span>
          {activeTradesCount > 0 && (
            <span className="absolute top-0 right-1 w-2 h-2 rounded-full bg-emerald-500" />
          )}
        </button>

        <button
          onClick={() => {
            if (currentTab === 'calendar') onSelectTab('analytics');
            else if (currentTab === 'analytics') onSelectTab('accounts');
            else if (currentTab === 'accounts') onSelectTab('settings');
            else onSelectTab('calendar');
          }}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
            ['calendar', 'analytics', 'accounts', 'settings'].includes(currentTab)
              ? 'text-zinc-100 font-semibold'
              : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          <BarChart3 className="w-4 h-4 mb-0.5" />
          <span className="capitalize">
            {['calendar', 'analytics', 'accounts', 'settings'].includes(currentTab)
              ? currentTab
              : 'More'}
          </span>
        </button>
      </nav>
    </>
  );
}
