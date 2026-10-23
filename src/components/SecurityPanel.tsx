import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, LogOut, RefreshCw } from 'lucide-react';
import { safeFetch } from '../utils/api';

type Kind = 'login_ok' | 'login_failed' | 'login_limited' | 'lockout' | 'unauthorized' | 'flood' | 'signout_all';
interface Ev { id: string; at: string; kind: Kind; address: string; device: string; detail?: string }
interface Tally { logins: number; wrongPins: number; lockouts: number; refused: number; floods: number }
interface Summary { events: Ev[]; day: Tally; week: Tally; alertsTo: string; emailOn: boolean; demo?: boolean }

const LABEL: Record<Kind, { text: string; bad: boolean }> = {
  login_ok: { text: 'Logged in', bad: false },
  login_failed: { text: 'Wrong PIN', bad: true },
  login_limited: { text: 'Too many wrong PINs — device paused', bad: true },
  lockout: { text: 'All logins paused', bad: true },
  unauthorized: { text: 'Refused: tried to open owner information without logging in', bad: true },
  flood: { text: 'Refused: too many form submissions', bad: true },
  signout_all: { text: 'Every device signed out', bad: false },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * What happened at the Command Center's door. The website blocks attempts on
 * its own; this shows Paul what it blocked, and lets him sign every device out.
 */
export const SecurityPanel: React.FC = () => {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await safeFetch('/api/security');
      if (!res.ok) return setError('The security activity could not be loaded.');
      setData(await res.json());
      setError('');
    } catch {
      setError('The security activity could not be loaded: the website could not be reached.');
    }
  };
  useEffect(() => { void load(); }, []);

  const signOutEveryone = async () => {
    if (!window.confirm('Sign every device out of the Command Center? You will need your PIN again too.')) return;
    setBusy(true);
    try {
      const res = await safeFetch('/api/security/signout-all', { method: 'POST' });
      if (!res.ok) setError('Could not sign everyone out. Try again, or call Otis.');
      // Success ends this session too; the portal asks for the PIN on its next request.
      else await load();
    } finally {
      setBusy(false);
    }
  };

  const worrying = data ? data.day.wrongPins + data.day.lockouts + data.day.refused + data.day.floods : 0;

  return (
    <div className="space-y-4" data-testid="security-panel">
      <div className={`p-4 border flex items-start gap-3 ${worrying ? 'border-amber-600 bg-amber-950/40' : 'border-emerald-700 bg-emerald-950/30'}`}>
        {worrying ? <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0" aria-hidden="true" /> : <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" aria-hidden="true" />}
        <div className="text-sm text-zinc-200">
          <strong className="block text-zinc-100">
            {!data ? 'Loading…' : worrying ? `${worrying} blocked attempt${worrying === 1 ? '' : 's'} in the last 24 hours` : 'All quiet in the last 24 hours'}
          </strong>
          The website blocks wrong PINs, owner-only requests without a login, and floods of form submissions on its own.
          This is what it saw.{' '}
          {data?.demo
            ? 'In the demo nothing is being watched, so this list stays empty.'
            : data && (data.emailOn && data.alertsTo
              ? `Alerts and new-login notices are emailed to ${data.alertsTo}.`
              : 'Email alerts switch on once the shop’s email account is connected.')}
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
          {([['Logins', data.week.logins], ['Wrong PINs', data.week.wrongPins], ['Lockouts', data.week.lockouts], ['Refused requests', data.week.refused], ['Floods refused', data.week.floods]] as const).map(([label, n]) => (
            <div key={label} className="bg-zinc-950 border border-zinc-800 p-3">
              <div className="text-xl font-black text-zinc-100 tabular-nums">{n}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label} · 7 days</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={signOutEveryone} disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-black uppercase tracking-wider bg-red-700 hover:bg-red-600 text-white cursor-pointer disabled:opacity-50">
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" /> Sign everyone out
        </button>
        <button type="button" onClick={() => void load()}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-black uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-100 cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Refresh
        </button>
      </div>
      <p className="text-[11px] text-zinc-500">
        Use “Sign everyone out” if you think someone has seen your PIN, then ask Otis to change it.
      </p>

      {data && (
        <div className="bg-zinc-950 border border-zinc-800">
          <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-zinc-800">Recent activity</div>
          {data.events.length === 0 ? (
            <p className="p-3 text-sm text-zinc-400">Nothing recorded yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-800/70 text-xs">
              {data.events.map((e) => (
                <li key={e.id} className="px-3 py-2 flex flex-wrap gap-x-3 gap-y-0.5 items-baseline">
                  <span className="text-zinc-500 tabular-nums w-28 flex-shrink-0">{when(e.at)}</span>
                  <span className={LABEL[e.kind]?.bad ? 'text-amber-300 font-bold' : 'text-zinc-200 font-bold'}>{LABEL[e.kind]?.text ?? e.kind}</span>
                  <span className="text-zinc-500">{e.device} · {e.address}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
