import type { BuildStatus, InvoiceStatus } from '../types';

type Status = BuildStatus | InvoiceStatus;

const COLOR_MAP: Record<Status, string> = {
  Queued: 'bg-gray-100 text-gray-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Parts Wait': 'bg-amber-100 text-amber-700',
  Completed: 'bg-green-100 text-green-700',
  Delivered: 'bg-teal-100 text-teal-700',
  Paid: 'bg-green-100 text-green-700',
  Pending: 'bg-yellow-100 text-yellow-700',
  Overdue: 'bg-red-100 text-red-700',
};

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${COLOR_MAP[status]}`}>
      {status}
    </span>
  );
}
