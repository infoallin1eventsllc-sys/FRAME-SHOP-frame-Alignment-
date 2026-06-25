import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { useApp } from '../../context/AppContext';
import type { Invoice, InvoiceStatus } from '../../types';

const STATUSES: InvoiceStatus[] = ['Pending', 'Paid', 'Overdue', 'Parts Wait'];

function blank(): Invoice {
  const now = new Date().toISOString().split('T')[0]!;
  return {
    id: `i${Date.now()}`,
    invoiceNumber: `INV-${String(Date.now()).slice(-4)}`,
    customerId: '',
    projectId: '',
    status: 'Pending',
    amount: 0,
    amountPaid: 0,
    issueDate: now,
    dueDate: now,
    lineItems: [],
  };
}

export function InvoiceModal({
  open, invoice, saving, onClose, onSave,
}: {
  open: boolean;
  invoice: Invoice | null;
  saving: boolean;
  onClose: () => void;
  onSave: (inv: Invoice) => void;
}) {
  const { customers, projects } = useApp();
  const [form, setForm] = useState<Invoice>(blank);

  useEffect(() => { setForm(invoice ?? blank()); }, [invoice, open]);

  const field = (key: keyof Invoice, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const labelCls  = 'block text-xs font-medium text-zinc-400 mb-1';
  const inputCls  = 'w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500';

  return (
    <Modal open={open} title={invoice ? `Edit ${invoice.invoiceNumber}` : 'New Invoice'} onClose={onClose} width="max-w-xl">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Invoice #</label>
            <input className={inputCls} value={form.invoiceNumber} onChange={e => field('invoiceNumber', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={form.status} onChange={e => field('status', e.target.value as InvoiceStatus)}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Customer</label>
          <select className={inputCls} value={form.customerId} onChange={e => field('customerId', e.target.value)}>
            <option value="">Select customer…</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Project</label>
          <select className={inputCls} value={form.projectId} onChange={e => field('projectId', e.target.value)}>
            <option value="">Select project…</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Issue Date</label>
            <input type="date" className={inputCls} value={form.issueDate} onChange={e => field('issueDate', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Due Date</label>
            <input type="date" className={inputCls} value={form.dueDate} onChange={e => field('dueDate', e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Amount ($)</label>
            <input type="number" className={inputCls} value={form.amount} onChange={e => field('amount', Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Amount Paid ($)</label>
            <input type="number" className={inputCls} value={form.amountPaid} onChange={e => field('amountPaid', Number(e.target.value))} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={() => onSave(form)} disabled={saving}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black text-sm font-semibold rounded-lg transition-colors">
            {saving ? 'Saving…' : invoice ? 'Save Changes' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
