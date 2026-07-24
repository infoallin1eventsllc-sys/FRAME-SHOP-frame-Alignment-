import { useState } from 'react';
import { useShop } from '../context/ShopContext';
import StatusBadge from './StatusBadge';
import Modal from './Modal';
import ExportCsvButton from './ExportCsvButton';
import {
  projectsForCustomer,
  invoicesForCustomer,
  customerLifetimeSpend,
  customerOutstandingBalance,
} from '../utils/calculations';
import type { Customer, NewCustomer } from '../types';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const EMPTY_FORM: NewCustomer = { name: '', phone: '', email: '', notes: '' };

function CustomerForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: NewCustomer;
  onCancel: () => void;
  onSubmit: (data: NewCustomer) => void;
}) {
  const [form, setForm] = useState<NewCustomer>(initial);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSubmit(form);
      }}
      className="space-y-3"
    >
      <div>
        <label className="text-xs font-medium text-gray-500">Name</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500">Phone</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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

export default function Customers() {
  const { customers, projects, invoices, addCustomer, updateCustomer, deleteCustomer } = useShop();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedCustomer = selected ? customers.find((c) => c.id === selected) : null;

  function handleDelete(id: string) {
    if (!confirm('Delete this customer? This cannot be undone.')) return;
    const result = deleteCustomer(id);
    if (!result.ok) {
      setError(result.reason ?? 'Could not delete this customer.');
      return;
    }
    setSelected(null);
  }

  if (selectedCustomer) {
    const balance = customerOutstandingBalance(invoices, selectedCustomer.id);
    const spend = customerLifetimeSpend(invoices, selectedCustomer.id);

    return (
      <div className="p-6 max-w-5xl space-y-5">
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to all customers
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
            {error}
          </div>
        )}

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
              <p className="text-xl font-bold text-gray-900">{fmt(spend)}</p>
              {balance > 0 && (
                <p className="text-sm font-semibold text-red-600 mt-0.5">{fmt(balance)} outstanding</p>
              )}
              <div className="flex gap-2 justify-end mt-3">
                <button
                  onClick={() => setEditing(selectedCustomer)}
                  className="flex items-center gap-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg px-2.5 py-1.5 hover:border-blue-400 hover:text-blue-600"
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(selectedCustomer.id)}
                  className="flex items-center gap-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg px-2.5 py-1.5 hover:bg-red-50"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
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
            {projectsForCustomer(projects, selectedCustomer.id).length === 0 && (
              <p className="text-sm text-gray-400">No projects yet.</p>
            )}
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
            {invoicesForCustomer(invoices, selectedCustomer.id).length === 0 && (
              <p className="text-sm text-gray-400">No invoices yet.</p>
            )}
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

        {editing && (
          <Modal title="Edit Customer" onClose={() => setEditing(null)}>
            <CustomerForm
              initial={editing}
              onCancel={() => setEditing(null)}
              onSubmit={(data) => {
                updateCustomer(editing.id, data);
                setEditing(null);
              }}
            />
          </Modal>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
        >
          <Plus size={16} /> New Customer
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <ExportCsvButton
          filename="customers"
          rows={filtered.map((c) => ({
            name: c.name,
            phone: c.phone,
            email: c.email,
            outstandingBalance: customerOutstandingBalance(invoices, c.id),
            lifetimeSpend: customerLifetimeSpend(invoices, c.id),
            notes: c.notes,
            createdAt: c.createdAt,
          }))}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
            { key: 'outstandingBalance', label: 'Outstanding Balance' },
            { key: 'lifetimeSpend', label: 'Lifetime Spend' },
            { key: 'notes', label: 'Notes' },
            { key: 'createdAt', label: 'Customer Since' },
          ]}
        />
      </div>

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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                  {customers.length === 0
                    ? 'No customers yet — add your first one to get started.'
                    : 'No customers match your search.'}
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const balance = customerOutstandingBalance(invoices, c.id);
                const spend = customerLifetimeSpend(invoices, c.id);
                return (
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
                        balance > 0 ? 'text-red-600' : 'text-gray-400'
                      }`}
                    >
                      {balance > 0 ? fmt(balance) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">{fmt(spend)}</td>
                    <td className="px-5 py-3 text-gray-500">{c.createdAt}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <Modal title="New Customer" onClose={() => setShowAdd(false)}>
          <CustomerForm
            initial={EMPTY_FORM}
            onCancel={() => setShowAdd(false)}
            onSubmit={(data) => {
              addCustomer(data);
              setShowAdd(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
