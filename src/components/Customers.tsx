import { useState } from 'react';
import { useShop } from '../context/ShopContext';
import StatusBadge from './StatusBadge';
import { projectsForCustomer, invoicesForCustomer } from '../utils/calculations';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function Customers() {
  const { customers, projects, invoices } = useShop();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedCustomer = selected ? customers.find((c) => c.id === selected) : null;

  if (selectedCustomer) {
    return (
      <div className="p-6 max-w-5xl space-y-5">
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to all customers
        </button>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{selectedCustomer.name}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{selectedCustomer.email}</p>
              <p className="text-sm text-gray-500">{selectedCustomer.phone}</p>
              <p className="text-xs text-gray-400 mt-1">Customer since {selectedCustomer.createdAt}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Lifetime Spend</p>
              <p className="text-xl font-bold text-gray-900">{fmt(selectedCustomer.lifetimeSpend)}</p>
              {selectedCustomer.outstandingBalance > 0 && (
                <p className="text-sm font-semibold text-red-600 mt-0.5">
                  {fmt(selectedCustomer.outstandingBalance)} outstanding
                </p>
              )}
            </div>
          </div>
          {selectedCustomer.notes && (
            <p className="mt-4 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
              {selectedCustomer.notes}
            </p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Projects</h3>
          <div className="space-y-2">
            {projectsForCustomer(projects, selectedCustomer.id).map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between text-sm"
              >
                <span className="font-medium text-gray-900">{p.title}</span>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Invoices</h3>
          <div className="space-y-2">
            {invoicesForCustomer(invoices, selectedCustomer.id).map((inv) => (
              <div
                key={inv.id}
                className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between text-sm"
              >
                <span className="font-mono text-gray-700">{inv.id}</span>
                <div className="flex items-center gap-3">
                  <StatusBadge status={inv.status} />
                  <span className="font-semibold">{fmt(inv.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Customers</h1>
      <input
        type="text"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-5 py-3 text-left">Name</th>
              <th className="px-5 py-3 text-left">Contact</th>
              <th className="px-5 py-3 text-right">Outstanding</th>
              <th className="px-5 py-3 text-right">Lifetime Spend</th>
              <th className="px-5 py-3 text-left">Since</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => setSelected(c.id)}
                className="hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-5 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-5 py-3 text-gray-500">
                  <p>{c.email}</p>
                  <p>{c.phone}</p>
                </td>
                <td
                  className={`px-5 py-3 text-right font-medium ${
                    c.outstandingBalance > 0 ? 'text-red-600' : 'text-gray-400'
                  }`}
                >
                  {c.outstandingBalance > 0 ? fmt(c.outstandingBalance) : '—'}
                </td>
                <td className="px-5 py-3 text-right text-gray-700">{fmt(c.lifetimeSpend)}</td>
                <td className="px-5 py-3 text-gray-500">{c.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
