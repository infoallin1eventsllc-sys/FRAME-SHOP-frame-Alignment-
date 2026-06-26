import { useState } from 'react';
import { useShop } from '../context/ShopContext';
import StatusBadge from './StatusBadge';
import type { BuildStatus } from '../types';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const STATUSES: BuildStatus[] = ['Queued', 'In Progress', 'Parts Wait', 'Completed', 'Delivered'];

export default function Projects() {
  const { projects, customers } = useShop();
  const [statusFilter, setStatusFilter] = useState<BuildStatus | 'All'>('All');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered =
    statusFilter === 'All' ? projects : projects.filter((p) => p.status === statusFilter);

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">Projects &amp; Builds</h1>

      <div className="flex gap-1 flex-wrap">
        {(['All', ...STATUSES] as (BuildStatus | 'All')[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              statusFilter === s
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-gray-400 text-sm py-8 text-center">No projects match this filter.</p>
        )}
        {filtered.map((p) => {
          const customer = customers.find((c) => c.id === p.customerId);
          const isOpen = expanded === p.id;
          const variance = p.actualCost > 0 ? p.actualCost - p.estimatedCost : null;

          return (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : p.id)}
                className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{p.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {customer?.name ?? '—'} · Started {p.startDate}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={p.status} />
                  <span className="text-sm text-gray-600 font-medium">{fmt(p.estimatedCost)}</span>
                  <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50">
                  <p className="text-sm text-gray-700">{p.description}</p>
                  <div className="flex gap-1 flex-wrap">
                    {p.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="bg-white rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500">Estimated</p>
                      <p className="font-semibold text-gray-900 mt-0.5">{fmt(p.estimatedCost)}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500">Actual So Far</p>
                      <p className="font-semibold text-gray-900 mt-0.5">
                        {p.actualCost > 0 ? fmt(p.actualCost) : '—'}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-3">
                      <p className="text-xs text-gray-500">Variance</p>
                      <p
                        className={`font-semibold mt-0.5 ${
                          variance === null
                            ? 'text-gray-400'
                            : variance > 0
                            ? 'text-red-600'
                            : 'text-green-600'
                        }`}
                      >
                        {variance === null
                          ? '—'
                          : (variance > 0 ? '+' : '') + fmt(variance)}
                      </p>
                    </div>
                  </div>
                  {p.technicianNotes && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                      <span className="font-semibold">Tech note: </span>
                      {p.technicianNotes}
                    </div>
                  )}
                  {p.completedDate && (
                    <p className="text-xs text-gray-500">Completed: {p.completedDate}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
