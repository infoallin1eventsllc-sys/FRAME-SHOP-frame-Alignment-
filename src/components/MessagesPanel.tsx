import React, { useEffect, useState } from 'react';
import { Mail, Phone, CheckCircle2, Circle, Trash2, RefreshCw } from 'lucide-react';
import { safeFetch } from '../utils/api';

export interface ContactMessage {
  id: string;
  name: string;
  reach: string;
  message: string;
  createdAt: string;
  handled: boolean;
}

/** The owner's list of contact-form messages, newest first. */
export async function fetchMessages(): Promise<{ messages: ContactMessage[]; unhandled: number } | null> {
  try {
    const res = await safeFetch('/api/messages');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** A phone number becomes a tap-to-call link, an email a mail link, anything else plain text. */
function ReachLink({ reach }: { reach: string }) {
  if (/@/.test(reach)) {
    return (
      <a href={`mailto:${reach}`} className="inline-flex items-center gap-1.5 text-orange-400 hover:text-orange-300 underline">
        <Mail className="w-3.5 h-3.5" aria-hidden="true" />
        {reach}
      </a>
    );
  }
  const digits = reach.replace(/\D/g, '');
  if (digits.length >= 10) {
    return (
      <a href={`tel:${digits}`} className="inline-flex items-center gap-1.5 text-orange-400 hover:text-orange-300 underline">
        <Phone className="w-3.5 h-3.5" aria-hidden="true" />
        {reach}
      </a>
    );
  }
  return <span className="text-zinc-300">{reach}</span>;
}

export const MessagesPanel: React.FC<{ onCountChange?: (unhandled: number) => void }> = ({ onCountChange }) => {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const data = await fetchMessages();
    if (data) {
      setMessages(data.messages);
      setError('');
      onCountChange?.(data.unhandled);
    } else {
      setError('Could not load messages. Check your connection and refresh.');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setHandled = async (id: string, handled: boolean) => {
    const res = await safeFetch(`/api/messages/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handled }),
    }).catch(() => null);
    if (res?.ok) load();
    else setError('That change did not save. Try again.');
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this message for good?')) return;
    const res = await safeFetch(`/api/messages/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null);
    if (res?.ok) load();
    else setError('That message could not be deleted. Try again.');
  };

  return (
    <div className="space-y-4" data-testid="messages-panel">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-black text-zinc-100 uppercase italic">Customer Messages</h3>
          <p className="text-xs text-zinc-400">From the "Send Paul a quick message" form on the site. Tick one off once you've replied.</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider bg-zinc-950 text-zinc-300 hover:text-white border border-zinc-700 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {error && <p role="alert" className="text-sm font-bold text-red-400">{error}</p>}

      {!loading && !error && messages.length === 0 && (
        <p className="text-sm text-zinc-400 border border-dashed border-zinc-700 p-6 text-center">No messages yet.</p>
      )}

      <ul className="space-y-3">
        {messages.map((m) => (
          <li
            key={m.id}
            className={`border p-4 space-y-2 ${m.handled ? 'border-zinc-800 bg-zinc-950/40 opacity-70' : 'border-orange-600/50 bg-zinc-950'}`}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <div className="font-black text-zinc-100">{m.name}</div>
                <div className="text-xs"><ReachLink reach={m.reach} /></div>
              </div>
              <time dateTime={m.createdAt} className="text-[11px] text-zinc-400">
                {new Date(m.createdAt).toLocaleString()}
              </time>
            </div>
            <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">{m.message}</p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setHandled(m.id, !m.handled)}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black uppercase tracking-wider border border-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
              >
                {m.handled ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" /> : <Circle className="w-3.5 h-3.5" aria-hidden="true" />}
                {m.handled ? 'Replied — mark as new' : 'Mark as replied'}
              </button>
              <button
                type="button"
                onClick={() => remove(m.id)}
                aria-label={`Delete message from ${m.name}`}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-black uppercase tracking-wider border border-zinc-800 text-zinc-500 hover:text-red-400 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
