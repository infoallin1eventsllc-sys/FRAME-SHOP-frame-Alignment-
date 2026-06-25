import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { useApp } from '../../context/AppContext';
import type { Project, ProjectStatus, ProjectType } from '../../types';

const STATUSES: ProjectStatus[] = ['Queued', 'In Progress', 'Parts Wait', 'Completed', 'Delivered'];
const TYPES: ProjectType[] = ['Frame Modification', 'TIG Welding', 'CNC Work', 'Alignment', 'General Repair'];

function blank(): Project {
  const now = new Date().toISOString().split('T')[0]!;
  return {
    id: `p${Date.now()}`,
    customerId: '',
    title: '',
    type: 'Frame Modification',
    status: 'Queued',
    estimatedCost: 0,
    actualCost: 0,
    technicianNotes: '',
    startDate: now,
    estimatedCompletion: now,
    vehicle: '',
  };
}

export function ProjectModal({
  open, project, onClose, onSave,
}: {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onSave: (p: Project) => void;
}) {
  const { customers } = useApp();
  const [form, setForm] = useState<Project>(blank);

  useEffect(() => { setForm(project ?? blank()); }, [project, open]);

  const field = (key: keyof Project, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const labelCls = 'block text-xs font-medium text-zinc-400 mb-1';
  const inputCls = 'w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500';

  return (
    <Modal open={open} title={project ? 'Edit Build' : 'New Build'} onClose={onClose} width="max-w-xl">
      <div className="p-6 space-y-4">
        <div>
          <label className={labelCls}>Title</label>
          <input className={inputCls} value={form.title} onChange={e => field('title', e.target.value)} placeholder="e.g. Frame notch & drop" />
        </div>

        <div>
          <label className={labelCls}>Customer</label>
          <select className={inputCls} value={form.customerId} onChange={e => field('customerId', e.target.value)}>
            <option value="">Select customer...</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>Vehicle</label>
          <input className={inputCls} value={form.vehicle} onChange={e => field('vehicle', e.target.value)} placeholder="e.g. 2019 Ford F-250" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Type</label>
            <select className={inputCls} value={form.type} onChange={e => field('type', e.target.value as ProjectType)}>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={form.status} onChange={e => field('status', e.target.value as ProjectStatus)}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Estimated Cost ($)</label>
            <input type="number" className={inputCls} value={form.estimatedCost} onChange={e => field('estimatedCost', Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Actual Cost ($)</label>
            <input type="number" className={inputCls} value={form.actualCost} onChange={e => field('actualCost', Number(e.target.value))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Start Date</label>
            <input type="date" className={inputCls} value={form.startDate} onChange={e => field('startDate', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Est. Completion</label>
            <input type="date" className={inputCls} value={form.estimatedCompletion} onChange={e => field('estimatedCompletion', e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Technician Notes</label>
          <textarea
            rows={3}
            className={`${inputCls} resize-none`}
            value={form.technicianNotes}
            onChange={e => field('technicianNotes', e.target.value)}
            placeholder="Progress notes, blockers, next steps..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors">Cancel</button>
          <button
            onClick={() => onSave(form)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded-lg transition-colors"
          >
            {project ? 'Save Changes' : 'Add Build'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
