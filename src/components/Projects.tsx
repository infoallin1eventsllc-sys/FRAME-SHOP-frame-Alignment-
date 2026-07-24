import { useState } from 'react';
import { useShop } from '../context/ShopContext';
import StatusBadge from './StatusBadge';
import Modal from './Modal';
import ExportCsvButton from './ExportCsvButton';
import { subtractMoney } from '../utils/money';
import type { BuildStatus, NewProject, Project } from '../types';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const STATUSES: BuildStatus[] = ['Queued', 'In Progress', 'Parts Wait', 'Completed', 'Delivered'];

function emptyForm(customerId: string): NewProject {
  return {
    customerId,
    title: '',
    description: '',
    status: 'Queued',
    technicianNotes: '',
    estimatedCost: 0,
    startDate: new Date().toISOString().slice(0, 10),
    tags: [],
  };
}

function ProjectForm({
  initial,
  customers,
  onCancel,
  onSubmit,
}: {
  initial: NewProject;
  customers: { id: string; name: string }[];
  onCancel: () => void;
  onSubmit: (data: NewProject) => void;
}) {
  const [form, setForm] = useState<NewProject>(initial);
  const [tagsInput, setTagsInput] = useState(initial.tags.join(', '));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.customerId) return;
        onSubmit({
          ...form,
          tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
        });
      }}
      className="space-y-3"
    >
      <div>
        <label className="text-xs font-medium text-gray-500">Customer</label>
        <select
          required
          value={form.customerId}
          onChange={(e) => setForm({ ...form, customerId: e.target.value })}
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="" disabled>Select a customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500">Title</label>
        <input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as BuildStatus })}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">Estimated Cost ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.estimatedCost}
            onChange={(e) => setForm({ ...form, estimatedCost: Number(e.target.value) })}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500">Start Date</label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">Actual Cost ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.actualCost ?? 0}
            onChange={(e) => setForm({ ...form, actualCost: Number(e.target.value) })}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500">Tags (comma separated)</label>
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500">Technician Notes</label>
        <textarea
          value={form.technicianNotes}
          onChange={(e) => setForm({ ...form, technicianNotes: e.target.value })}
          rows={2}
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

export default function Projects() {
  const { projects, customers, invoices, addProject, updateProject, deleteProject } = useShop();
  const [statusFilter, setStatusFilter] = useState<BuildStatus | 'All'>('All');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered =
    statusFilter === 'All' ? projects : projects.filter((p) => p.status === statusFilter);

  function handleDelete(id: string) {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    const result = deleteProject(id);
    if (!result.ok) {
      setError(result.reason ?? 'Could not delete this project.');
      return;
    }
    setExpanded(null);
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Projects &amp; Builds</h1>
        <button
          onClick={() => setShowAdd(true)}
          disabled={customers.length === 0}
          title={customers.length === 0 ? 'Add a customer first' : undefined}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={16} /> New Project
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
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
        <ExportCsvButton
          filename="projects"
          rows={filtered.map((p) => ({
            title: p.title,
            customer: customers.find((c) => c.id === p.customerId)?.name ?? '',
            status: p.status,
            estimatedCost: p.estimatedCost,
            actualCost: p.actualCost,
            startDate: p.startDate,
            completedDate: p.completedDate ?? '',
            tags: p.tags.join('; '),
          }))}
          columns={[
            { key: 'title', label: 'Title' },
            { key: 'customer', label: 'Customer' },
            { key: 'status', label: 'Status' },
            { key: 'estimatedCost', label: 'Estimated Cost' },
            { key: 'actualCost', label: 'Actual Cost' },
            { key: 'startDate', label: 'Start Date' },
            { key: 'completedDate', label: 'Completed Date' },
            { key: 'tags', label: 'Tags' },
          ]}
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-gray-400 text-sm py-8 text-center">
            {projects.length === 0 ? 'No projects yet — add your first one to get started.' : 'No projects match this filter.'}
          </p>
        )}
        {filtered.map((p) => {
          const customer = customers.find((c) => c.id === p.customerId);
          const isOpen = expanded === p.id;
          const variance = p.actualCost > 0 ? subtractMoney(p.actualCost, p.estimatedCost) : null;
          const linkedInvoice = invoices.some((inv) => inv.projectId === p.id);

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
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setEditing(p)}
                      className="flex items-center gap-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white hover:border-blue-400 hover:text-blue-600"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={linkedInvoice}
                      title={linkedInvoice ? 'Remove linked invoices first' : undefined}
                      className="flex items-center gap-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg px-2.5 py-1.5 bg-white hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAdd && (
        <Modal title="New Project" onClose={() => setShowAdd(false)}>
          <ProjectForm
            initial={emptyForm(customers[0]?.id ?? '')}
            customers={customers}
            onCancel={() => setShowAdd(false)}
            onSubmit={(data) => {
              addProject(data);
              setShowAdd(false);
            }}
          />
        </Modal>
      )}

      {editing && (
        <Modal title="Edit Project" onClose={() => setEditing(null)}>
          <ProjectForm
            initial={editing}
            customers={customers}
            onCancel={() => setEditing(null)}
            onSubmit={(data) => {
              updateProject(editing.id, data);
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
