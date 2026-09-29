import React, { useEffect, useState } from 'react';
import { Sparkles, Send, Copy, Check, Trash2, RefreshCw, Megaphone, Inbox, Star, MailPlus, Radar, CalendarDays, Settings, BarChart3, ExternalLink } from 'lucide-react';
import { safeFetch } from '../utils/api';

type AgentId = 'content' | 'reply' | 'review_reply' | 'review_request' | 'campaign' | 'radar';

interface Draft {
  id: string;
  agent: AgentId;
  status: 'pending' | 'approved' | 'done' | 'discarded';
  createdAt: string;
  updatedAt: string;
  title: string;
  channel: string;
  subject?: string;
  body: string;
  hashtags?: string[];
  photoIdea?: string;
  suggestedDate?: string;
  sources?: { url: string; title: string }[];
  doneNote?: string;
}

interface DeskState {
  connected: boolean;
  emailConnected: boolean;
  model?: string;
  usage: { used: number; cap: number };
  settings: { brandVoice: string; googleReviewUrl: string; competitors: string; autopilot: boolean; lastDailyRun?: string; lastWeeklyRun?: string };
  drafts: Draft[];
  runs: { agent: AgentId; at: string; ok: boolean; drafts: number; error?: string }[];
  results: {
    bookings30: number; bookingsPrev30: number; sources90: { label: string; n: number }[]; services90: { label: string; n: number }[];
    invoiced30: number; collected30: number; outstanding: number; emailList: number; unsubscribed: number;
    messages30: number; messagesWaiting: number; published30: number; emailsSent30: number; reviewRequests30: number;
  };
}

const AGENT_INFO: Record<AgentId, { name: string; what: string; icon: React.ReactNode }> = {
  content: { name: 'Content planner', what: "Drafts next week's Instagram, Facebook and Google posts from your recent jobs and services.", icon: <CalendarDays className="w-4 h-4" /> },
  reply: { name: 'Inbox replies', what: 'Drafts a reply to every customer message still waiting.', icon: <Inbox className="w-4 h-4" /> },
  review_reply: { name: 'Review replies', what: 'Paste a review from Google or Facebook; get a reply in your voice.', icon: <Star className="w-4 h-4" /> },
  review_request: { name: 'Review requests', what: 'Drafts a "would you leave us a review?" email for each job finished in the last 30 days.', icon: <Megaphone className="w-4 h-4" /> },
  campaign: { name: 'Email campaign', what: 'Say what you want; it drafts an email to the customers who asked for offers.', icon: <MailPlus className="w-4 h-4" /> },
  radar: { name: 'Market radar', what: 'Searches the web for local competitors, events and demand, with links to where it found them.', icon: <Radar className="w-4 h-4" /> },
};

const EMAIL_AGENTS: AgentId[] = ['reply', 'review_request', 'campaign'];
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const box = 'bg-zinc-950 border border-zinc-800 p-4';
const input = 'w-full bg-zinc-900 border border-zinc-800 focus:border-orange-500 text-zinc-100 p-2 text-sm focus:outline-none';
const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider cursor-pointer disabled:opacity-50';

/** onDataChanged: something here changed bookings or messages (a reply sent, say), so the portal should refresh its counts. */
export const MarketingPanel: React.FC<{ onDataChanged?: () => void }> = ({ onDataChanged }) => {
  const [state, setState] = useState<DeskState | null>(null);
  const [view, setView] = useState<'queue' | 'run' | 'results' | 'settings' | 'history'>('queue');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<string>('');
  const [review, setReview] = useState({ text: '', rating: '5', reviewer: '' });
  const [goal, setGoal] = useState('');
  const [settings, setSettings] = useState<DeskState['settings'] | null>(null);

  const say = (kind: 'ok' | 'error', text: string) => setNotice({ kind, text });
  const errorOf = async (res: Response, fallback: string) => (await res.json().catch(() => ({})))?.error || `${fallback} (error ${res.status})`;

  const load = async () => {
    try {
      const res = await safeFetch('/api/marketing');
      if (!res.ok) return say('error', await errorOf(res, 'Could not load the Marketing Desk'));
      const data: DeskState = await res.json();
      setState(data);
      setSettings((s) => s ?? data.settings);
    } catch {
      say('error', 'Could not reach the website. Check your connection and press Refresh.');
    }
  };
  useEffect(() => {
    load();
  }, []);

  const run = async (agent: AgentId, body: object = {}) => {
    setBusy(agent);
    setNotice(null);
    try {
      const res = await safeFetch(`/api/marketing/run/${agent}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return say('error', await errorOf(res, 'The assistant could not run'));
      const data = await res.json();
      say('ok', data.message);
      if (data.drafts?.length) setView('queue');
      if (agent === 'review_reply') setReview({ text: '', rating: '5', reviewer: '' });
      if (agent === 'campaign') setGoal('');
      await load();
    } catch {
      say('error', 'The assistant could not be reached. Try again in a minute.');
    } finally {
      setBusy('');
    }
  };

  const patch = async (id: string, body: object) => {
    const res = await safeFetch(`/api/marketing/drafts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res?.ok) {
      say('error', res ? await errorOf(res, 'That change did not save') : 'That change did not save: the website could not be reached.');
      return false;
    }
    await load();
    return true;
  };

  const send = async (d: Draft) => {
    const who = d.agent === 'campaign' ? `${state?.results.emailList ?? 0} customers on your offers list` : 'the customer';
    if (!window.confirm(`Email this to ${who} now?`)) return;
    setBusy(d.id);
    try {
      const res = await safeFetch(`/api/marketing/drafts/${d.id}/send`, { method: 'POST' });
      if (!res.ok) return say('error', await errorOf(res, 'It did not send'));
      say('ok', (await res.json()).message);
      await load();
      onDataChanged?.();
    } finally {
      setBusy('');
    }
  };

  const markDone = async (d: Draft, note: string) => {
    const res = await safeFetch(`/api/marketing/drafts/${d.id}/done`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    }).catch(() => null);
    if (!res?.ok) return say('error', 'Could not mark it done.');
    say('ok', note + '.');
    await load();
    onDataChanged?.();
  };

  const copy = async (d: Draft) => {
    const text = [d.subject ? `Subject: ${d.subject}` : '', d.body, d.hashtags?.length ? d.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ') : '']
      .filter(Boolean)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      say('ok', 'Copied. Paste it where it is going, then press Mark posted.');
    } catch {
      say('error', 'Your browser would not copy it. Select the text and copy it by hand.');
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setBusy('settings');
    try {
      const res = await safeFetch('/api/marketing/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) return say('error', await errorOf(res, 'Settings did not save'));
      setSettings((await res.json()).settings);
      say('ok', 'Settings saved.');
      await load();
    } finally {
      setBusy('');
    }
  };

  if (!state) {
    return <div className="text-sm text-zinc-400">{notice ? <span role="alert" className="text-red-400 font-bold">{notice.text}</span> : 'Loading the Marketing Desk…'}</div>;
  }

  const queue = state.drafts.filter((d) => d.status === 'pending' || d.status === 'approved');
  const history = state.drafts.filter((d) => d.status === 'done');
  const r = state.results;

  return (
    <div className="space-y-5 font-sans" data-testid="marketing-panel">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-xl font-black text-zinc-100 uppercase italic flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-500" /> Marketing Desk
          </h3>
          <p className="text-xs text-zinc-400 max-w-2xl">
            Assistants draft your posts, replies and emails from your own shop records. Nothing goes out until you approve it.
          </p>
        </div>
        <button type="button" onClick={load} className={`${btn} bg-zinc-950 border border-zinc-700 text-zinc-300`}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] font-bold" data-testid="marketing-status">
        <span className={`px-2 py-1 border ${state.connected ? 'border-emerald-600/50 text-emerald-400' : 'border-amber-600/60 text-amber-300'}`}>
          Assistant: {state.model === 'demo' ? 'demo samples only — no AI in the preview' : state.connected ? `connected · ${state.usage.used}/${state.usage.cap} runs today` : 'not connected yet'}
        </span>
        <span className={`px-2 py-1 border ${state.emailConnected ? 'border-emerald-600/50 text-emerald-400' : 'border-zinc-700 text-zinc-400'}`}>
          Email sending: {state.emailConnected ? 'on' : 'off — copy and send by hand'}
        </span>
        <span className="px-2 py-1 border border-zinc-700 text-zinc-400">Autopilot: {state.settings.autopilot ? 'on' : 'off'}</span>
      </div>
      {!state.connected && (
        <p className="text-xs text-amber-200 bg-amber-950/40 border border-amber-600/50 p-3">
          The assistants need an Anthropic API key on the server, on your own account (console.anthropic.com). Until then
          they can't draft anything; everything else here works.
        </p>
      )}

      <nav className="flex flex-wrap gap-1" aria-label="Marketing Desk">
        {([
          ['queue', `To approve (${queue.length})`, <Check key="i" className="w-3.5 h-3.5" />],
          ['run', 'Run an assistant', <Sparkles key="i" className="w-3.5 h-3.5" />],
          ['results', 'Results', <BarChart3 key="i" className="w-3.5 h-3.5" />],
          ['history', `Sent & posted (${history.length})`, <Send key="i" className="w-3.5 h-3.5" />],
          ['settings', 'Settings', <Settings key="i" className="w-3.5 h-3.5" />],
        ] as const).map(([id, label, icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setView(id);
              setNotice(null);
            }}
            aria-current={view === id ? 'page' : undefined}
            className={`${btn} ${view === id ? 'bg-orange-600 text-white' : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white'}`}
          >
            {icon} {label}
          </button>
        ))}
      </nav>

      {notice && (
        <p role={notice.kind === 'error' ? 'alert' : 'status'} className={`text-sm font-bold ${notice.kind === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
          {notice.text}
        </p>
      )}

      {view === 'queue' && (
        <div className="space-y-3">
          {queue.length === 0 && (
            <p className={`${box} text-sm text-zinc-400 text-center`}>
              Nothing waiting. Run an assistant{state.settings.autopilot ? ', or wait for autopilot' : ''} and its drafts appear here.
            </p>
          )}
          {queue.map((d) => (
            <article key={d.id} className={`${box} space-y-3 ${d.status === 'approved' ? 'border-emerald-700/60' : ''}`} data-testid="draft">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                    {AGENT_INFO[d.agent].name} · {d.channel}
                    {d.suggestedDate ? ` · for ${d.suggestedDate}` : ''}
                  </div>
                  <div className="font-black text-zinc-100">{d.title}</div>
                </div>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 border ${d.status === 'approved' ? 'border-emerald-600 text-emerald-400' : 'border-zinc-700 text-zinc-400'}`}>
                  {d.status === 'approved' ? 'Approved' : 'Draft'}
                </span>
              </div>
              {d.subject !== undefined && (
                <div>
                  <label htmlFor={`subj-${d.id}`} className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Subject</label>
                  <input id={`subj-${d.id}`} defaultValue={d.subject} onBlur={(e) => e.target.value !== d.subject && patch(d.id, { subject: e.target.value })} className={input} />
                </div>
              )}
              <div>
                <label htmlFor={`body-${d.id}`} className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">
                  {d.channel === 'brief' ? 'Brief' : 'Text'} — edit freely
                </label>
                <textarea
                  id={`body-${d.id}`}
                  defaultValue={d.body}
                  rows={Math.min(14, Math.max(4, d.body.split('\n').length + 1))}
                  onBlur={(e) => e.target.value !== d.body && patch(d.id, { body: e.target.value })}
                  className={`${input} whitespace-pre-wrap`}
                />
                {/\[ask Paul/i.test(d.body) && (
                  <p className="text-[11px] text-amber-300 mt-1">Fill in the [ask Paul: …] parts before this goes out.</p>
                )}
              </div>
              {!!d.hashtags?.length && <p className="text-xs text-sky-300 break-words">{d.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}</p>}
              {d.photoIdea && <p className="text-xs text-zinc-400"><strong className="text-zinc-300">Photo:</strong> {d.photoIdea}</p>}
              {!!d.sources?.length && (
                <ul className="text-[11px] space-y-0.5">
                  {d.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 break-all">
                        <ExternalLink className="w-3 h-3 flex-shrink-0" /> {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {d.status === 'pending' ? (
                  <button type="button" onClick={() => patch(d.id, { status: 'approved' })} className={`${btn} bg-emerald-700 hover:bg-emerald-600 text-white`}>
                    <Check className="w-3.5 h-3.5" /> Approve
                  </button>
                ) : (
                  <>
                    {EMAIL_AGENTS.includes(d.agent) && d.channel === 'email' && (
                      <button type="button" disabled={busy === d.id || !state.emailConnected} onClick={() => send(d)} className={`${btn} bg-orange-600 hover:bg-orange-500 text-white`}
                        title={state.emailConnected ? '' : 'Email sending is off — copy it instead'}>
                        <Send className="w-3.5 h-3.5" /> {busy === d.id ? 'Sending…' : d.agent === 'campaign' ? `Send to ${r.emailList}` : 'Send email'}
                      </button>
                    )}
                    <button type="button" onClick={() => copy(d)} className={`${btn} bg-zinc-800 hover:bg-zinc-700 text-zinc-100`}>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                    {d.channel !== 'brief' && (
                      <button type="button" onClick={() => markDone(d, d.channel === 'email' || d.channel === 'text' ? 'Sent by hand' : 'Posted')} className={`${btn} bg-zinc-900 border border-zinc-700 text-zinc-300`}>
                        {d.channel === 'email' || d.channel === 'text' ? 'Mark sent' : 'Mark posted'}
                      </button>
                    )}
                    {d.channel === 'brief' && (
                      <button type="button" onClick={() => markDone(d, 'Read')} className={`${btn} bg-zinc-900 border border-zinc-700 text-zinc-300`}>
                        Mark read
                      </button>
                    )}
                  </>
                )}
                <button type="button" onClick={() => patch(d.id, { status: 'discarded' })} className={`${btn} text-zinc-500 hover:text-red-400`} aria-label={`Discard ${d.title}`}>
                  <Trash2 className="w-3.5 h-3.5" /> Discard
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {view === 'run' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.keys(AGENT_INFO) as AgentId[]).map((id) => (
            <div key={id} className={`${box} space-y-2`}>
              <div className="font-black text-zinc-100 flex items-center gap-2 text-orange-400">{AGENT_INFO[id].icon}<span className="text-zinc-100">{AGENT_INFO[id].name}</span></div>
              <p className="text-xs text-zinc-400">{AGENT_INFO[id].what}</p>
              {id === 'review_reply' && (
                <div className="space-y-2">
                  <label htmlFor="rv-text" className="sr-only">Review text</label>
                  <textarea id="rv-text" rows={3} placeholder="Paste the review here" value={review.text} onChange={(e) => setReview({ ...review, text: e.target.value })} className={input} />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="rv-name" className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Reviewer's first name</label>
                      <input id="rv-name" value={review.reviewer} onChange={(e) => setReview({ ...review, reviewer: e.target.value })} className={input} />
                    </div>
                    <div>
                      <label htmlFor="rv-rating" className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Stars</label>
                      <select id="rv-rating" value={review.rating} onChange={(e) => setReview({ ...review, rating: e.target.value })} className={input}>
                        {['5', '4', '3', '2', '1'].map((n) => <option key={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
              {id === 'campaign' && (
                <div>
                  <label htmlFor="cp-goal" className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">What is this email for?</label>
                  <input id="cp-goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. spring check-ups before riding season" className={input} />
                  <p className="text-[11px] text-zinc-500 mt-1">Goes only to the {r.emailList} customer{r.emailList === 1 ? '' : 's'} who ticked "send me offers". Unsubscribe link added automatically.</p>
                </div>
              )}
              {id === 'review_request' && !state.settings.googleReviewUrl && (
                <p className="text-[11px] text-amber-300">Add your Google review link in Settings first.</p>
              )}
              <button
                type="button"
                disabled={!!busy || !state.connected}
                onClick={() => run(id, id === 'review_reply' ? { review: review.text, rating: review.rating, reviewer: review.reviewer } : id === 'campaign' ? { goal } : {})}
                className={`${btn} bg-orange-600 hover:bg-orange-500 text-white`}
              >
                <Sparkles className="w-3.5 h-3.5" /> {busy === id ? 'Working… (up to a minute)' : 'Run'}
              </button>
            </div>
          ))}
          <div className={`${box} md:col-span-2`}>
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Recent runs</div>
            {state.runs.length === 0 ? (
              <p className="text-xs text-zinc-500">None yet.</p>
            ) : (
              <ul className="text-xs space-y-1">
                {state.runs.slice(0, 8).map((x, i) => (
                  <li key={i} className={x.ok ? 'text-zinc-300' : 'text-red-400'}>
                    {new Date(x.at).toLocaleString()} · {AGENT_INFO[x.agent]?.name ?? x.agent} · {x.ok ? `${x.drafts} draft${x.drafts === 1 ? '' : 's'}` : `failed: ${x.error}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {view === 'results' && (
        <div className="space-y-3" data-testid="marketing-results">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Bookings, last 30 days', String(r.bookings30), `${r.bookingsPrev30} the 30 days before`],
              ['Collected, last 30 days', money(r.collected30), `${money(r.invoiced30)} invoiced`],
              ['Still owed', money(r.outstanding), 'across all invoices'],
              ['Offers list', String(r.emailList), `${r.unsubscribed} unsubscribed`],
              ['Messages, last 30 days', String(r.messages30), `${r.messagesWaiting} waiting for a reply`],
              ['Posts published', String(r.published30), 'last 30 days, marked posted'],
              ['Emails sent', String(r.emailsSent30), 'last 30 days'],
              ['Review requests', String(r.reviewRequests30), 'sent, last 30 days'],
            ].map(([label, value, sub]) => (
              <div key={label} className={box}>
                <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{label}</div>
                <div className="text-2xl font-black text-zinc-100 font-mono tabular-nums">{value}</div>
                <div className="text-[10px] text-zinc-500">{sub}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {([['Where customers heard about you (90 days)', r.sources90], ['What they booked (90 days)', r.services90]] as const).map(([label, rows]) => (
              <div key={label} className={box}>
                <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2">{label}</div>
                {rows.length === 0 ? (
                  <p className="text-xs text-zinc-500">No bookings yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {rows.map((row) => {
                      const max = Math.max(...rows.map((x) => x.n));
                      return (
                        <li key={row.label} className="text-xs">
                          <div className="flex justify-between text-zinc-300"><span>{row.label}</span><span className="font-mono tabular-nums">{row.n}</span></div>
                          <div className="h-1.5 bg-zinc-800"><div className="h-1.5 bg-orange-600" style={{ width: `${(row.n / max) * 100}%` }} /></div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-zinc-500">Every number here comes from your own bookings, invoices and messages. "Where customers heard about you" fills in as people answer the new question on the booking form.</p>
        </div>
      )}

      {view === 'history' && (
        <ul className="space-y-2">
          {history.length === 0 && <li className={`${box} text-sm text-zinc-400 text-center`}>Nothing sent or posted yet.</li>}
          {history.map((d) => (
            <li key={d.id} className={`${box} text-xs`}>
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="font-bold text-zinc-100">{d.title}</span>
                <span className="text-zinc-500">{new Date(d.updatedAt).toLocaleString()}</span>
              </div>
              <div className="text-emerald-400">{d.doneNote}</div>
              <p className="text-zinc-400 whitespace-pre-wrap mt-1 line-clamp-3">{d.body}</p>
            </li>
          ))}
        </ul>
      )}

      {view === 'settings' && settings && (
        <div className={`${box} space-y-4`}>
          <div>
            <label htmlFor="mk-voice" className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">How you sound (every assistant follows this)</label>
            <textarea id="mk-voice" rows={4} value={settings.brandVoice} onChange={(e) => setSettings({ ...settings, brandVoice: e.target.value })} className={input} />
          </div>
          <div>
            <label htmlFor="mk-review" className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">Your Google review link</label>
            <input id="mk-review" value={settings.googleReviewUrl} placeholder="https://g.page/r/…/review" onChange={(e) => setSettings({ ...settings, googleReviewUrl: e.target.value })} className={input} />
            <p className="text-[11px] text-zinc-500 mt-1">Google Business Profile → "Ask for reviews" → copy the link.</p>
          </div>
          <div>
            <label htmlFor="mk-comp" className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">Competitors to keep an eye on (optional)</label>
            <input id="mk-comp" value={settings.competitors} placeholder="Shop names or websites, separated by commas" onChange={(e) => setSettings({ ...settings, competitors: e.target.value })} className={input} />
          </div>
          <label htmlFor="mk-auto" className="flex items-start gap-2 text-sm text-zinc-200 cursor-pointer">
            <input id="mk-auto" type="checkbox" checked={settings.autopilot} onChange={(e) => setSettings({ ...settings, autopilot: e.target.checked })} className="mt-1 w-4 h-4 accent-orange-600" />
            <span>
              <strong>Autopilot</strong> — every morning, draft replies to new messages and review requests; every Monday, draft the week's posts and the market brief.
              <span className="block text-[11px] text-zinc-500">Drafts only. Nothing is sent or posted without your approval.</span>
            </span>
          </label>
          <button type="button" onClick={saveSettings} disabled={busy === 'settings'} className={`${btn} bg-orange-600 hover:bg-orange-500 text-white`}>
            {busy === 'settings' ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      )}
    </div>
  );
};
