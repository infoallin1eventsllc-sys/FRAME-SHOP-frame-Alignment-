import { useState } from 'react';
import { Plus, Phone, Mail, Car } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { SearchInput } from '../ui/SearchInput';
import { CustomerModal } from './CustomerModal';
import type { Customer } from '../../types';

export function CustomersPage() {
  const { customers, projects, addCustomer, updateCustomer } = useApp();
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving,   setSaving]   = useState(false);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.vehicle.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSave = async (c: Customer) => {
    setSaving(true);
    try {
      if (selected) await updateCustomer(c);
      else await addCustomer(c);
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
      <div className="flex-none flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
        <div className="w-64">
          <SearchInput value={search} onChange={setSearch} placeholder="Search customers…" />
        </div>
        <span className="text-xs text-zinc-500">{customers.length} total</span>
        <button onClick={() => setCreating(true)}
          className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Customer
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 && (
          <p className="text-sm text-zinc-600 text-center py-16">No customers found.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((cust, i) => {
            const custProjects  = projects.filter(p => p.customerId === cust.id);
            const activeBuilds  = custProjects.filter(p => p.status === 'In Progress' || p.status === 'Parts Wait').length;
            return (
              <motion.div key={cust.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                onClick={() => setSelected(cust)}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 cursor-pointer transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{cust.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Since {cust.joinedDate}</p>
                  </div>
                  {cust.outstandingBalance > 0 && (
                    <span className="text-xs font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                      Owes ${cust.outstandingBalance.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5 text-xs text-zinc-500">
                  <div className="flex items-center gap-2"><Phone className="w-3 h-3 flex-none" /><span>{cust.phone}</span></div>
                  <div className="flex items-center gap-2"><Mail className="w-3 h-3 flex-none" /><span className="truncate">{cust.email}</span></div>
                  <div className="flex items-center gap-2"><Car className="w-3 h-3 flex-none" /><span className="truncate">{cust.vehicle}</span></div>
                </div>
                <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{custProjects.length}</p>
                    <p className="text-xs text-zinc-600">Jobs</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-400">{activeBuilds}</p>
                    <p className="text-xs text-zinc-600">Active</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-400">${cust.lifetimeSpend.toLocaleString()}</p>
                    <p className="text-xs text-zinc-600">Lifetime</p>
                  </div>
                </div>
                {cust.notes && (
                  <p className="mt-3 text-xs text-zinc-600 italic line-clamp-2">{cust.notes}</p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <CustomerModal
        open={creating || selected !== null}
        customer={selected}
        saving={saving}
        onClose={() => { setCreating(false); setSelected(null); }}
        onSave={handleSave}
      />
    </div>
  );
}
