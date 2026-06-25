import { useState } from 'react';
import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { Badge } from '../ui/Badge';
import { SearchInput } from '../ui/SearchInput';
import { ProjectModal } from './ProjectModal';
import type { Project, ProjectStatus } from '../../types';

const STATUSES: ProjectStatus[] = ['Queued', 'In Progress', 'Parts Wait', 'Completed', 'Delivered'];

export function ProjectsPage() {
  const { projects, customers, addProject, updateProject } = useApp();
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<ProjectStatus | 'All'>('All');
  const [selected, setSelected] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving,   setSaving]   = useState(false);

  const filtered = projects.filter(p => {
    const cust = customers.find(c => c.id === p.customerId);
    const matchSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (cust?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      p.vehicle.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || p.status === filter;
    return matchSearch && matchFilter;
  });

  const handleSave = async (p: Project) => {
    setSaving(true);
    try {
      if (selected) await updateProject(p);
      else await addProject(p);
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
          <SearchInput value={search} onChange={setSearch} placeholder="Search builds or customers…" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(['All', ...STATUSES] as const).map(s => (
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
          <Plus className="w-3.5 h-3.5" /> New Build
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 && (
          <p className="text-sm text-zinc-600 text-center py-16">No builds found.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project, i) => {
            const cust = customers.find(c => c.id === project.customerId);
            const pct = project.estimatedCost > 0
              ? Math.min(Math.round((project.actualCost / project.estimatedCost) * 100), 100)
              : 0;
            return (
              <motion.div key={project.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                onClick={() => setSelected(project)}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 cursor-pointer transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-100 leading-snug">{project.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{cust?.name ?? '—'}</p>
                  </div>
                  <Badge status={project.status} />
                </div>
                <div className="space-y-2 text-xs text-zinc-500">
                  <div className="flex justify-between">
                    <span>Type</span><span className="text-zinc-300">{project.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vehicle</span>
                    <span className="text-zinc-300 truncate max-w-[60%] text-right">{project.vehicle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Est. completion</span>
                    <span className="text-zinc-300">{project.estimatedCompletion}</span>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                    <span>${project.actualCost.toLocaleString()} / ${project.estimatedCost.toLocaleString()}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                {project.technicianNotes && (
                  <p className="mt-3 text-xs text-zinc-600 italic line-clamp-2">{project.technicianNotes}</p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <ProjectModal
        open={creating || selected !== null}
        project={selected}
        saving={saving}
        onClose={() => { setCreating(false); setSelected(null); }}
        onSave={handleSave}
      />
    </div>
  );
}
