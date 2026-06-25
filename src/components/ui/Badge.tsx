import type { InvoiceStatus, ProjectStatus } from '../../types';

type BadgeStatus = InvoiceStatus | ProjectStatus;

const styles: Record<BadgeStatus, string> = {
  Paid:          'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
  Pending:       'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
  Overdue:       'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
  'Parts Wait':  'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30',
  Queued:        'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30',
  'In Progress': 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
  Completed:     'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
  Delivered:     'bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/30',
};

export function Badge({ status }: { status: BadgeStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${styles[status]}`}>
      {status}
    </span>
  );
}
