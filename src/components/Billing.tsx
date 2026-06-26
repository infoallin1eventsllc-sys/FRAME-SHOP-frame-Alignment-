import { useState } from 'react';
import { useShop } from '../context/ShopContext';
import StatusBadge from './StatusBadge';
import { totalBilled, totalCollected, totalOutstanding } from '../utils/calculations';
import type { InvoiceStatus } from '../types';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const STATUS_FILTERS: (InvoiceStatus | 'All')[] = [
  'All', 'Paid', 'Pending', 'Overdue', 'Parts Wait',
];

export default function Billing() {
  const { invoices, customers } = useShop();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'All'>('All');
  const [page, setPage] = useState(1);
  const PER_PAGE = 5;

  const filtered = invoices.filter((inv) => {
    const customer = customers.find((c) => c.id === inv.customerId);
    const matchesSearch =
      inv.id.toLowerCase().includes(search.toLowerCase()) ||
      (customer?.name.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">Billing</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Billed</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(totalBilled(invoices))}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Collected</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{fmt(totalCollected(invoices))}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Outstanding</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{fmt(totalOutstanding(invoices))}</p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by customer or invoice ID…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
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
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-5 py-3 text-left">Invoice</th>
              <th className="px-5 py-3 text-left">Customer</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3 text-right">Paid</th>
              <th className="px-5 py-3 text-right">Balance</th>
              <th className="px-5 py-3 text-left">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                  No invoices match your filters.
                </td>
              </tr>
            ) : (
              paginated.map((inv) => {
                const customer = customers.find((c) => c.id === inv.customerId);
                return (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-gray-700">{inv.id}</td>
                    <td className="px-5 py-3 text-gray-900 font-medium">
                      {customer?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-3 text-right">{fmt(inv.amount)}</td>
                    <td className="px-5 py-3 text-right text-green-700">{fmt(inv.paidAmount)}</td>
                    <td className="px-5 py-3 text-right text-red-600">
                      {fmt(inv.amount - inv.paidAmount)}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{inv.dueDate}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
          <span>{filtered.length} invoice{filtered.length !== 1 ? 's' : ''}</span>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40"
            >
              ‹
            </button>
            <span>{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
