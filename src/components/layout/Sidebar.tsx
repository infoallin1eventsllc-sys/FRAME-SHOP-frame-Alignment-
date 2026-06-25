import { LayoutDashboard, Receipt, Wrench, Users } from 'lucide-react';
import type { FC } from 'react';
import { useApp } from '../../context/AppContext';
import type { View } from '../../types';

const navItems: { view: View; label: string; icon: FC<{ className?: string }> }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'billing',   label: 'Billing',   icon: Receipt },
  { view: 'projects',  label: 'Projects',  icon: Wrench },
  { view: 'customers', label: 'Customers', icon: Users },
];

export function Sidebar() {
  const { activeView, setActiveView } = useApp();

  return (
    <aside className="w-56 flex-none flex flex-col bg-zinc-900 border-r border-zinc-800">
      <div className="px-5 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-none">
            <span className="text-black font-bold text-sm">FS</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100 leading-none">Frame Shop</p>
            <p className="text-xs text-zinc-500 mt-0.5">Shop Management</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ view, label, icon: Icon }) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
              activeView === view
                ? 'bg-amber-500/10 text-amber-400'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            }`}
          >
            <Icon className="w-4 h-4 flex-none" />
            {label}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-zinc-800">
        <p className="px-3 text-xs text-zinc-600">Built by Otis Williams</p>
      </div>
    </aside>
  );
}
