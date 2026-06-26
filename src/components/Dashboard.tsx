import { useShop } from '../context/ShopContext';
import StatusBadge from './StatusBadge';
import {
  totalBilled,
  totalCollected,
  totalOutstanding,
  countByBuildStatus,
  activeProjectsValue,
  overdueInvoices,
} from '../utils/calculations';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { invoices, projects, customers } = useShop();
  const overdue = overdueInvoices(invoices);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">Shop Floor Monitor</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Billed" value={fmt(totalBilled(invoices))} />
        <StatCard label="Collected" value={fmt(totalCollected(invoices))} />
        <StatCard label="Outstanding" value={fmt(totalOutstanding(invoices))} />
        <StatCard
          label="Active Pipeline"
          value={fmt(activeProjectsValue(projects))}
          sub="estimated"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="In Progress"
          value={String(countByBuildStatus(projects, 'In Progress'))}
          sub="active builds"
        />
        <StatCard
          label="Parts Wait"
          value={String(countByBuildStatus(projects, 'Parts Wait'))}
          sub="waiting on parts"
        />
        <StatCard
          label="Queued"
          value={String(countByBuildStatus(projects, 'Queued'))}
          sub="upcoming"
        />
        <StatCard
          label="Customers"
          value={String(customers.length)}
          sub="total on file"
        />
      </div>

      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-red-800 mb-3">Overdue Invoices</h2>
          <ul className="space-y-2">
            {overdue.map((inv) => {
              const customer = customers.find((c) => c.id === inv.customerId);
              return (
                <li key={inv.id} className="flex items-center justify-between text-sm">
                  <span className="text-red-700 font-medium">{customer?.name ?? 'Unknown'}</span>
                  <span className="text-red-600 font-semibold">
                    {fmt(inv.amount - inv.paidAmount)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Active Builds</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-5 py-2 text-left">Project</th>
              <th className="px-5 py-2 text-left">Customer</th>
              <th className="px-5 py-2 text-left">Status</th>
              <th className="px-5 py-2 text-right">Est. Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {projects
              .filter((p) => p.status !== 'Delivered')
              .map((p) => {
                const customer = customers.find((c) => c.id === p.customerId);
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{p.title}</td>
                    <td className="px-5 py-3 text-gray-600">{customer?.name ?? '—'}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">{fmt(p.estimatedCost)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
