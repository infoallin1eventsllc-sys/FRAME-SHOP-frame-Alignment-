import { useState } from 'react';
import { useShop } from '../context/ShopContext';
import StatusBadge from './StatusBadge';
import Modal from './Modal';
import ExportCsvButton from './ExportCsvButton';
import { totalBilled, totalCollected, totalOutstanding, calcLineItemTotal } from '../utils/calculations';
import { subtractMoney } from '../utils/money';
import type { InvoiceStatus, Invoice, LineItem, NewInvoice } from '../types';
import { Plus, Pencil, Trash2, DollarSign } from 'lucide-react';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const STATUS_FILTERS: (InvoiceStatus | 'All')[] = [
  'All', 'Paid', 'Pending', 'Overdue', 'Parts Wait',
];
const STATUSES: InvoiceStatus[] = ['Paid', 'Pending', 'Overdue', 'Parts Wait'];

function emptyLineItem(): LineItem {
  return { description: '', quantity: 1, unitPrice: 0 };
}

function emptyForm(customerId: string): NewInvoice {
  return {
    customerId,
    projectId: '',
    status: 'Pending',
    dueDate: new Date().toISOString().slice(0, 10),
    lineItems: [emptyLineItem()],
  };
}

function InvoiceForm({
  initial,
  customers,
  projects,
  onCancel,
  onSubmit,
}: {
  initial: NewInvoice;
  customers: { id: string; name: string }[];
  projects: { id: string; title: string; customerId: string }[];
  onCancel: () => void;
  onSubmit: (data: NewInvoice) => void;
}) {
  const [form, setForm] = useState<NewInvoice>(initial);
  const customerProjects = projects.filter((p) => p.customerId === form.customerId);
  const total = calcLineItemTotal(form.lineItems);

  function updateLineItem(index: number, patch: Partial<LineItem>) {
    setForm({
      ...form,
      lineItems: form.lineItems.map((li, i) => (i === index ? { ...li, ...patch } : li)),
    });
  }

  function addLineItem() {
    setForm({ ...form, lineItems: [...form.lineItems, emptyLineItem()] });
  }

  function removeLineItem(index: number) {
    setForm({ ...form, lineItems: form.lineItems.filter((_, i) => i !== index) });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.customerId || form.lineItems.length === 0) return;
        onSubmit(form);
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500">Customer</label>
          <select
            required
            value={form.customerId}
            onChange={(e) => setForm({ ...form, customerId: e.target.value, projectId: '' })}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>Select a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">Project (optional)</label>
          <select
            value={form.projectId}
            onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No linked project</option>
            {customerProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as InvoiceStatus })}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">Due Date</label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-500">Line Items</label>
          <button
            type="button"
            onClick={addLineItem}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            + Add line
          </button>
        </div>
        <div className="space-y-2">
          {form.lineItems.map((li, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                placeholder="Description"
                value={li.description}
                onChange={(e) => updateLineItem(i, { description: e.target.value })}
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Qty"
                value={li.quantity}
                onChange={(e) => updateLineItem(i, { quantity: Number(e.target.value) })}
                className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Unit $"
                value={li.unitPrice}
                onChange={(e) => updateLineItem(i, { unitPrice: Number(e.target.value) })}
                className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => removeLineItem(i)}
                disabled={form.lineItems.length === 1}
                className="text-gray-400 hover:text-red-600 disabled:opacity-30 px-1 py-1.5"
                aria-label="Remove line"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <p className="text-right text-sm font-semibold text-gray-800 mt-2">
          Total: {fmt(total)}
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
        >
          Save
        </button>
      </div>
    </form>
  );
}

export default function Billing() {
  const {
    invoices,
    customers,
    projects,
    addInvoice,
    updateInvoice,
    deleteInvoice,
    recordPayment,
  } = useShop();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'All'>('All');
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
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

  function submitPayment() {
    if (!paying) return;
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) return;
    recordPayment(paying.id, amount);
    setPaying(null);
    setPaymentAmount('');
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <button
          onClick={() => setShowAdd(true)}
          disabled={customers.length === 0}
          title={customers.length === 0 ? 'Add a customer first' : undefined}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={16} /> New Invoice
        </button>
      </div>

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

      <div className="flex gap-3 flex-wrap items-center justify-between">
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
        <ExportCsvButton
          filename="invoices"
          rows={filtered.map((inv) => ({
            id: inv.id,
            customer: customers.find((c) => c.id === inv.customerId)?.name ?? '',
            status: inv.status,
            amount: inv.amount,
            paidAmount: inv.paidAmount,
            balance: subtractMoney(inv.amount, inv.paidAmount),
            createdAt: inv.createdAt,
            dueDate: inv.dueDate,
          }))}
          columns={[
            { key: 'id', label: 'Invoice' },
            { key: 'customer', label: 'Customer' },
            { key: 'status', label: 'Status' },
            { key: 'amount', label: 'Amount' },
            { key: 'paidAmount', label: 'Paid' },
            { key: 'balance', label: 'Balance' },
            { key: 'createdAt', label: 'Created' },
            { key: 'dueDate', label: 'Due' },
          ]}
        />
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
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-gray-400">
                  {invoices.length === 0
                    ? 'No invoices yet — create your first one to get started.'
                    : 'No invoices match your filters.'}
                </td>
              </tr>
            ) : (
              paginated.map((inv) => {
                const customer = customers.find((c) => c.id === inv.customerId);
                const balance = subtractMoney(inv.amount, inv.paidAmount);
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
                      {balance > 0 ? fmt(balance) : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{inv.dueDate}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5 justify-end">
                        {balance > 0 && (
                          <button
                            onClick={() => setPaying(inv)}
                            title="Record payment"
                            className="text-gray-400 hover:text-green-600 p-1"
                          >
                            <DollarSign size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => setEditing(inv)}
                          title="Edit invoice"
                          className="text-gray-400 hover:text-blue-600 p-1"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this invoice? This cannot be undone.')) {
                              deleteInvoice(inv.id);
                            }
                          }}
                          title="Delete invoice"
                          className="text-gray-400 hover:text-red-600 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
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

      {showAdd && (
        <Modal title="New Invoice" onClose={() => setShowAdd(false)} wide>
          <InvoiceForm
            initial={emptyForm(customers[0]?.id ?? '')}
            customers={customers}
            projects={projects}
            onCancel={() => setShowAdd(false)}
            onSubmit={(data) => {
              addInvoice(data);
              setShowAdd(false);
            }}
          />
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit ${editing.id}`} onClose={() => setEditing(null)} wide>
          <InvoiceForm
            initial={editing}
            customers={customers}
            projects={projects}
            onCancel={() => setEditing(null)}
            onSubmit={(data) => {
              updateInvoice(editing.id, data);
              setEditing(null);
            }}
          />
        </Modal>
      )}

      {paying && (
        <Modal title={`Record Payment — ${paying.id}`} onClose={() => setPaying(null)}>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Balance due: <span className="font-semibold">{fmt(subtractMoney(paying.amount, paying.paidAmount))}</span>
            </p>
            <div>
              <label className="text-xs font-medium text-gray-500">Payment Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                autoFocus
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPaying(null)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitPayment}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
              >
                Record Payment
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
