import { DollarSign, Wrench, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import type { FC } from 'react';
import { useApp } from '../../context/AppContext';
import { Badge } from '../ui/Badge';

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: FC<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-zinc-100 mt-1.5">{value}</p>
          {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-none ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { projects, invoices, customers, setActiveView } = useApp();

  const activeBuilds = projects.filter(
    p => p.status === 'In Progress' || p.status === 'Parts Wait',
  );
  const jobsDone = projects.filter(
    p => p.status === 'Completed' || p.status === 'Delivered',
  ).length;
  const totalOutstanding = invoices.reduce(
    (sum, inv) => sum + (inv.amount - inv.amountPaid), 0,
  );
  const totalCollected = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const overdueInvoices = invoices.filter(i => i.status === 'Overdue');
  const partsWaitProjects = projects.filter(p => p.status === 'Parts Wait');

  const fmt = (n: number) => `$${n.toLocaleString()}`;

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Builds', value: String(activeBuilds.length), sub: 'In Progress or Parts Wait', icon: Wrench, accent: 'bg-amber-500/10 text-amber-400' },
          { label: 'Outstanding', value: fmt(totalOutstanding), sub: 'Unpaid invoices', icon: AlertCircle, accent: 'bg-red-500/10 text-red-400' },
          { label: 'Collected', value: fmt(totalCollected), sub: 'All time', icon: DollarSign, accent: 'bg-emerald-500/10 text-emerald-400' },
          { label: 'Jobs Done', value: String(jobsDone), sub: 'Completed & delivered', icon: CheckCircle2, accent: 'bg-violet-500/10 text-violet-400' },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <StatCard {...card} />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active builds list */}
        <motion.div
          className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        >
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">Active Builds</h2>
            <button
              onClick={() => setActiveView('projects')}
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              View all
            </button>
          </div>
          {activeBuilds.length === 0 ? (
            <p className="px-5 py-10 text-sm text-zinc-600 text-center">No active builds.</p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {activeBuilds.map(project => {
                const customer = customers.find(c => c.id === project.customerId);
                const pct = project.estimatedCost > 0
                  ? Math.min(Math.round((project.actualCost / project.estimatedCost) * 100), 100)
                  : 0;
                return (
                  <div key={project.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-100 truncate">{project.title}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {customer?.name ?? '—'} &middot; {project.vehicle}
                        </p>
                      </div>
                      <Badge status={project.status} />
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                        <span>${project.actualCost.toLocaleString()} spent of ${project.estimatedCost.toLocaleString()} est.</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    {project.technicianNotes && (
                      <p className="mt-2 text-xs text-zinc-600 italic line-clamp-1">{project.technicianNotes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Attention panel */}
        <motion.div
          className="bg-zinc-900 border border-zinc-800 rounded-xl"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        >
          <div className="px-5 py-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-100">Attention Needed</h2>
          </div>
          {overdueInvoices.length === 0 && partsWaitProjects.length === 0 ? (
            <p className="px-5 py-10 text-sm text-zinc-600 text-center">All clear.</p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {overdueInvoices.map(inv => {
                const cust = customers.find(c => c.id === inv.customerId);
                return (
                  <div key={inv.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-100">{inv.invoiceNumber}</p>
                      <Badge status={inv.status} />
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{cust?.name ?? '—'}</p>
                    <p className="text-sm font-semibold text-red-400 mt-1">${inv.amount.toLocaleString()}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">Due {inv.dueDate}</p>
                  </div>
                );
              })}
              {partsWaitProjects.map(p => (
                <div key={p.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-100 truncate">{p.title}</p>
                    <Badge status={p.status} />
                  </div>
                  <p className="text-xs text-zinc-600 mt-1 line-clamp-2">{p.technicianNotes}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
