import { useState } from 'react';
import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { Badge } from '../ui/Badge';
import { SearchInput } from '../ui/SearchInput';
import { InvoiceModal } from './InvoiceModal';
import type { Invoice, InvoiceStatus } from '../../types';

const STATUS_FILTERS: (InvoiceStatus | 'All')[] = ['All', 'Pending', 'Paid', 'Overdue', 'Parts Wait'];

export function BillingPage() {
  const { invoices, customers, projects, getCustomerById, addInvoice, updateInvoice } = useApp();
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<InvoiceStatus | 'All'>('All');
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving,   setSaving]   = useState(false);

  const filtered = invoices.filter(inv => {
    const cust = getCustomerById(inv.customerId);
    const matchSearch =
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      (cust?.name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || inv.status === filter;
    return matchSearch && matchFilter;
  });

  const totalBilled      = invoices.reduce((s, i) => s + i.amount, 0);
  const totalCollected   = invoices.reduce((s, i) => s + i.amountPaid, 0);
  const totalOutstanding = totalBilled - totalCollected;
  const fmt = (n: number) => `$${n.toLocaleString()}`;

  const handleSave = async (inv: Invoice) => {
    setSaving(true);
    try {
      if (selected) await updateInvoice(inv);
      else await addInvoice(inv);
      setCreating(false);
      setSelected(null);
    } catch (err) {
      console.error(err);
      alert('Save failed. Check the console for details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div className="flex-none grid grid-cols-3 gap-px bg-zinc-800 border-b border-zinc-800">
        {[
          { label: 'Total Billed',  value: fmt(totalBilled),      color: 'text-zinc-100' },
          { label: 'Collected',     value: fmt(totalCollected),   color: 'text-emerald-400' },
          { label: 'Outstanding',   value: fmt(totalOutstanding), color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-950 px-6 py-4">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{label}</p>
            <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex-none flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
        <div className="w-64">
          <SearchInput value={search} onChange={setSearch} placeholder="Search invoices or customers…" />
        </div>
        <div className="flex gap-1">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === s ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
              }`}>
              {s}
            </button>
          ))}
        </div>
        <button onClick={() => setCreating(true)}
          className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Invoice
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800">
            <tr>
              {['Invoice', 'Customer', 'Project', 'Issued', 'Due', 'Amount', 'Paid', 'Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-600">No invoices found.</td></tr>
            )}
            {filtered.map((inv, i) => {
              const cust = customers.find(c => c.id === inv.customerId);
              const proj = projects.find(p => p.id === inv.projectId);
              return (
                <motion.tr key={inv.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  onClick={() => setSelected(inv)}
                  className="cursor-pointer hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-300">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3 text-zinc-200 font-medium">{cust?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-400 max-w-[160px] truncate">{proj?.title ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-400">{inv.issueDate}</td>
                  <td className="px-4 py-3 text-zinc-400">{inv.dueDate}</td>
                  <td className="px-4 py-3 text-zinc-200 font-medium">${inv.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-emerald-400">${inv.amountPaid.toLocaleString()}</td>
                  <td className="px-4 py-3"><Badge status={inv.status} /></td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <InvoiceModal
        open={creating || selected !== null}
        invoice={selected}
        saving={saving}
        onClose={() => { setCreating(false); setSelected(null); }}
        onSave={handleSave}
      />
    </div>
  );
}
