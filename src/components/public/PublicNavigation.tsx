import {
  LayoutDashboard,
  ClipboardList,
  Flame,
  CalendarDays,
  BarChart3,
} from 'lucide-react';

export type PublicNavTab = 'dashboard' | 'plans' | 'trades' | 'calendar' | 'analytics';

interface PublicNavigationProps {
  currentTab: PublicNavTab;
  onSelectTab: (tab: PublicNavTab) => void;
  plansCount?: number;
  tradesCount?: number;
}

export function PublicNavigation({
  currentTab,
  onSelectTab,
  plansCount = 0,
  tradesCount = 0,
}: PublicNavigationProps) {
  const navItems = [
    { id: 'dashboard' as PublicNavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'plans' as PublicNavTab, label: 'Plans', icon: ClipboardList, badge: plansCount > 0 ? plansCount : undefined },
    { id: 'trades' as PublicNavTab, label: 'Trades', icon: Flame, badge: tradesCount > 0 ? tradesCount : undefined },
    { id: 'calendar' as PublicNavTab, label: 'Calendar', icon: CalendarDays },
    { id: 'analytics' as PublicNavTab, label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <>
      {/* Desktop Navigation */}
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

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 px-2 py-1.5 flex items-center justify-around shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors relative ${
                isActive ? 'text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="absolute top-0 right-1 w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
