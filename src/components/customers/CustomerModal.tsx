import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import type { Customer } from '../../types';

function blank(): Customer {
  return {
    id: `c${Date.now()}`,
    name: '', phone: '', email: '', vehicle: '',
    outstandingBalance: 0, lifetimeSpend: 0, notes: '',
    joinedDate: new Date().toISOString().split('T')[0]!,
  };
}

export function CustomerModal({
  open, customer, saving, onClose, onSave,
}: {
  open: boolean;
  customer: Customer | null;
  saving: boolean;
  onClose: () => void;
  onSave: (c: Customer) => void;
}) {
  const [form, setForm] = useState<Customer>(blank);

  useEffect(() => { setForm(customer ?? blank()); }, [customer, open]);

  const field = (key: keyof Customer, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const labelCls = 'block text-xs font-medium text-zinc-400 mb-1';
  const inputCls = 'w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500';

  return (
    <Modal open={open} title={customer ? 'Edit Customer' : 'New Customer'} onClose={onClose}>
      <div className="p-6 space-y-4">
        <div>
          <label className={labelCls}>Full Name</label>
          <input className={inputCls} value={form.name} onChange={e => field('name', e.target.value)} placeholder="e.g. Marcus Webb" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} value={form.phone} onChange={e => field('phone', e.target.value)} placeholder="(214) 555-0000" />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} value={form.email} onChange={e => field('email', e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Vehicle</label>
          <input className={inputCls} value={form.vehicle} onChange={e => field('vehicle', e.target.value)} placeholder="e.g. 2019 Ford F-250" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Outstanding Balance ($)</label>
            <input type="number" className={inputCls} value={form.outstandingBalance} onChange={e => field('outstandingBalance', Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Lifetime Spend ($)</label>
            <input type="number" className={inputCls} value={form.lifetimeSpend} onChange={e => field('lifetimeSpend', Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea rows={3} className={`${inputCls} resize-none`}
            value={form.notes} onChange={e => field('notes', e.target.value)}
            placeholder="Payment preferences, referral source, etc." />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black text-sm font-semibold rounded-lg transition-colors">
            {saving ? 'Saving…' : customer ? 'Save Changes' : 'Add Customer'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
