import React, { useEffect, useState } from 'react';
import { exportRatesToExcel } from '../utils/spreadsheets';
import { openPrintable } from '../utils/saveFile';
import { Plus, Trash2, Save, FileSpreadsheet, Printer, Calculator, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { safeFetch } from '../utils/api';
import { SHOP_INFO } from '../data/shopData';
import type { ShopRates } from '../types';

/** Paul's rates as saved on the server; null until loaded or if unreachable. */
export async function fetchRates(): Promise<ShopRates | null> {
  try {
    const res = await safeFetch('/api/rates');
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const money = (n: number) => `$${n.toFixed(2)}`;
const numOrNull = (v: string): number | null => (v.trim() === '' ? null : Number(v));
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

/** Its own window, so the print is the rate sheet and not the whole portal. */
function printRates(rates: ShopRates) {
  const row = (a: string, b: string) => `<tr><td>${escapeHtml(a)}</td><td class="n">${escapeHtml(b)}</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Rate Sheet</title>
    <style>body{font:14px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:44rem;margin:2rem auto;padding:0 1rem;color:#18181b}
    h1{font-size:1.4rem;margin:0}p{color:#71717a;margin:.2rem 0 1.5rem}table{width:100%;border-collapse:collapse;margin-bottom:1.5rem}
    td,th{border-bottom:1px solid #e4e4e7;padding:.4rem;text-align:left}.n{text-align:right;white-space:nowrap}</style></head><body>
    <h1>${escapeHtml(SHOP_INFO.name)} — Rate Sheet</h1><p>Printed ${new Date().toLocaleDateString()}</p>
    <table>${row('Labor rate', rates.laborRate != null ? `${money(rates.laborRate)} / hr` : 'not set')}
    ${row('Shop supplies', `${rates.suppliesPct}%`)}${row('Sales tax', rates.taxPct != null ? `${rates.taxPct}%` : 'not set')}</table>
    <table><tr><th>Service</th><th class="n">Price</th><th>Unit</th></tr>
    ${rates.lines.map((l) => `<tr><td>${escapeHtml(l.name)}</td><td class="n">${l.price != null ? money(l.price) : '—'}</td><td>${escapeHtml(l.unit)}</td></tr>`).join('')}</table>
    </body></html>`;
  void openPrintable(html, 'The-Frame-Shop-Rate-Sheet.html', 800, 900);
}

export const RatesPanel: React.FC<{ onSaved?: (rates: ShopRates) => void }> = ({ onSaved }) => {
  const [rates, setRates] = useState<ShopRates | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Estimator inputs
  const [hours, setHours] = useState('1');
  const [partsCost, setPartsCost] = useState('0');
  const [markupPct, setMarkupPct] = useState('0');

  useEffect(() => {
    fetchRates().then((r) => (r ? setRates(r) : setLoadError('Could not load your rate sheet. Check your connection and reopen this tab.')));
  }, []);

  if (loadError) return <p role="alert" className="text-sm font-bold text-red-400">{loadError}</p>;
  if (!rates) return <p className="text-sm text-zinc-400">Loading your rates…</p>;

  const update = (patch: Partial<ShopRates>) => {
    setRates({ ...rates, ...patch });
    setStatus(null);
  };
  const updateLine = (i: number, patch: Partial<ShopRates['lines'][number]>) =>
    update({ lines: rates.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await safeFetch('/api/rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rates),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Save failed (${res.status}).`);
      setRates(data);
      onSaved?.(data);
      setStatus({ kind: 'ok', text: 'Rate sheet saved. New invoices will use these rates.' });
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof Error ? e.message : 'The rate sheet could not be saved.' });
    } finally {
      setSaving(false);
    }
  };

  // Estimator — only from Paul's own numbers.
  const h = Number(hours) || 0;
  const parts = Number(partsCost) || 0;
  const partsRetail = parts * (1 + (Number(markupPct) || 0) / 100);
  const labor = h * (rates.laborRate ?? 0);
  const sub = labor + partsRetail;
  const supplies = sub * (rates.suppliesPct / 100);
  const tax = (sub + supplies) * ((rates.taxPct ?? 0) / 100);
  const quote = sub + supplies + tax;
  const cost = rates.overheadPerHour != null ? h * rates.overheadPerHour + parts : null;
  const profit = cost != null ? sub + supplies - cost : null; // tax is not the shop's money

  const field = 'w-full bg-zinc-950 border border-zinc-800 focus:border-orange-500 text-zinc-100 p-2 text-xs font-mono focus:outline-none';
  const label = 'block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1';

  return (
    <div className="space-y-6 font-sans" data-testid="rates-panel">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-xl font-black text-zinc-100 uppercase italic">My Rates</h3>
          <p className="text-xs text-zinc-400 max-w-xl">
            Your prices, used to start every new invoice. Only you can see this page.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => printRates(rates)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-white cursor-pointer">
            <Printer className="w-3.5 h-3.5" aria-hidden="true" /> Print
          </button>
          <button type="button" onClick={() => exportRatesToExcel(rates)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider bg-emerald-950 border border-emerald-600/50 text-emerald-300 cursor-pointer">
            <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" /> Excel
          </button>
        </div>
      </div>

      {!rates.confirmedAt && (
        <div role="note" className="flex gap-3 border-2 border-amber-500/70 bg-amber-950/40 p-4 text-xs text-amber-100">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400" aria-hidden="true" />
          <p>
            <strong>Not saved yet.</strong> The prices below are the "starting at" prices your website currently shows
            customers — the only prices on record. Check each one, set your sales tax, and press <strong>Save rates</strong>.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label htmlFor="rate-labor" className={label}>Labor rate ($/hr)</label>
          <input id="rate-labor" type="number" min="0" step="0.01" value={rates.laborRate ?? ''} onChange={(e) => update({ laborRate: numOrNull(e.target.value) })} className={field} />
        </div>
        <div>
          <label htmlFor="rate-supplies" className={label}>Shop supplies (%)</label>
          <input id="rate-supplies" type="number" min="0" max="100" step="0.1" value={rates.suppliesPct} onChange={(e) => update({ suppliesPct: Number(e.target.value) || 0 })} className={field} />
        </div>
        <div>
          <label htmlFor="rate-tax" className={label}>Sales tax (%)</label>
          <input id="rate-tax" type="number" min="0" max="100" step="0.01" value={rates.taxPct ?? ''} placeholder="Not set" onChange={(e) => update({ taxPct: numOrNull(e.target.value) })} className={field} />
        </div>
        <div>
          <label htmlFor="rate-overhead" className={label}>Your cost per hour ($)</label>
          <input id="rate-overhead" type="number" min="0" step="0.01" value={rates.overheadPerHour ?? ''} placeholder="Optional" onChange={(e) => update({ overheadPerHour: numOrNull(e.target.value) })} className={field} />
        </div>
      </div>
      <p className="text-[11px] text-zinc-500">
        Sales tax: check with your accountant which rate applies at the shop's address, and whether repair labor is taxable in Texas. Tax is charged on the whole invoice total.
        "Your cost per hour" is only used below to estimate profit.
      </p>

      <div className="border border-zinc-800 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900 text-[10px] font-black uppercase text-zinc-400">
            <tr>
              <th className="p-2">Service</th>
              <th className="p-2 w-28">Price ($)</th>
              <th className="p-2 w-32">Unit</th>
              <th className="p-2">Notes</th>
              <th className="p-2 w-10"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 bg-zinc-950">
            {rates.lines.map((l, i) => (
              <tr key={l.id}>
                <td className="p-2"><input aria-label="Service name" value={l.name} onChange={(e) => updateLine(i, { name: e.target.value })} className={field} /></td>
                <td className="p-2"><input aria-label={`Price for ${l.name}`} type="number" min="0" step="0.01" value={l.price ?? ''} placeholder="—" onChange={(e) => updateLine(i, { price: numOrNull(e.target.value) })} className={field} /></td>
                <td className="p-2">
                  <select aria-label={`Unit for ${l.name}`} value={l.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} className={field}>
                    {['flat', 'starting at', 'per hour', 'per wheel', 'per item'].map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </td>
                <td className="p-2"><input aria-label={`Notes for ${l.name}`} value={l.note} onChange={(e) => updateLine(i, { note: e.target.value })} className={field} /></td>
                <td className="p-2 text-center">
                  <button type="button" aria-label={`Remove ${l.name}`} onClick={() => update({ lines: rates.lines.filter((_, j) => j !== i) })} className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => update({ lines: [...rates.lines, { id: `rate-${Date.now()}`, name: 'New service', price: null, unit: 'flat', note: '' }] })}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider bg-zinc-950 border border-zinc-800 text-orange-400 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add service
        </button>
        <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-black uppercase tracking-wider bg-orange-600 hover:bg-orange-500 disabled:opacity-60 text-white cursor-pointer">
          <Save className="w-4 h-4" aria-hidden="true" /> {saving ? 'Saving…' : 'Save rates'}
        </button>
      </div>
      {status && (
        <p role={status.kind === 'error' ? 'alert' : 'status'} className={`text-sm font-bold flex items-center gap-2 ${status.kind === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
          {status.kind === 'ok' && <CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
          {status.text}
        </p>
      )}

      <div className="border-2 border-orange-600/60 p-4 space-y-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-1.5">
          <Calculator className="w-4 h-4" aria-hidden="true" /> Quick quote
        </div>
        {rates.laborRate == null ? (
          <p className="text-xs text-zinc-400">Set your labor rate above to use the quote calculator.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="est-hours" className={label}>Labor hours</label>
                <input id="est-hours" type="number" min="0" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} className={field} />
              </div>
              <div>
                <label htmlFor="est-parts" className={label}>Parts cost ($)</label>
                <input id="est-parts" type="number" min="0" step="1" value={partsCost} onChange={(e) => setPartsCost(e.target.value)} className={field} />
              </div>
              <div>
                <label htmlFor="est-markup" className={label}>Parts markup (%)</label>
                <input id="est-markup" type="number" min="0" step="1" value={markupPct} onChange={(e) => setMarkupPct(e.target.value)} className={field} />
              </div>
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs" data-testid="quote-result">
              <div><dt className="text-zinc-400 font-sans text-[10px] uppercase font-black">Labor</dt><dd className="text-lg font-black text-zinc-100">{money(labor)}</dd></div>
              <div><dt className="text-zinc-400 font-sans text-[10px] uppercase font-black">Parts</dt><dd className="text-lg font-black text-zinc-100">{money(partsRetail)}</dd></div>
              <div><dt className="text-zinc-400 font-sans text-[10px] uppercase font-black">Customer pays</dt><dd className="text-lg font-black text-amber-400">{money(quote)}</dd>
                <dd className="text-[10px] text-zinc-500 font-sans">incl. supplies {money(supplies)}{rates.taxPct != null ? `, tax ${money(tax)}` : ', no tax set'}</dd></div>
              <div><dt className="text-zinc-400 font-sans text-[10px] uppercase font-black">Profit</dt>
                <dd className="text-lg font-black text-emerald-400">{profit != null ? money(profit) : '—'}</dd>
                {profit == null && <dd className="text-[10px] text-zinc-500 font-sans">Enter your cost per hour to see this</dd>}
              </div>
            </dl>
          </>
        )}
      </div>
    </div>
  );
};
