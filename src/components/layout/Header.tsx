import { Bell, Settings } from 'lucide-react';

const viewTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  billing: 'Billing',
  projects: 'Projects & Builds',
  customers: 'Customers',
};

export function Header({ view }: { view: string }) {
  return (
    <header className="h-14 flex-none flex items-center justify-between px-6 border-b border-zinc-800 bg-zinc-950">
      <h1 className="text-base font-semibold text-zinc-100">
        {viewTitles[view] ?? view}
      </h1>
      <div className="flex items-center gap-1">
        <button className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <button className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
