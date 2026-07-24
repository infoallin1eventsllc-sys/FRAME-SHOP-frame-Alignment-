import { Download } from 'lucide-react';
import { exportToCsv } from '../utils/csv';

interface Props<T extends Record<string, unknown>> {
  filename: string;
  rows: T[];
  columns: { key: keyof T; label: string }[];
  label?: string;
}

export default function ExportCsvButton<T extends Record<string, unknown>>({
  filename,
  rows,
  columns,
  label = 'Export CSV',
}: Props<T>) {
  return (
    <button
      type="button"
      onClick={() => exportToCsv(filename, rows, columns)}
      disabled={rows.length === 0}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      title={rows.length === 0 ? 'Nothing to export' : `Export ${rows.length} row(s) to CSV`}
    >
      <Download size={14} />
      {label}
    </button>
  );
}
