import React, { useRef, useState } from 'react';
import { SHOP_INFO, FAQS } from '../data/shopData';
import { ClickToLoadMap } from './ClickToLoadMap';
import { Phone, Mail, MapPin, Clock, Instagram, Send, CheckCircle2, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';

function newMessageKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const ContactSection: React.FC = () => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const inFlightRef = useRef(false);
  // One key per message, so a double tap or a retry after a dropped reply
  // saves it once. Replaced only when the customer starts a new message.
  const messageKeyRef = useRef(newMessageKey());

  // This used to set the "sent" flag and nothing else: every message typed
  // here was thrown away while the page told the customer Paul had it.
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSending(true);
    setSendError('');
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          reach: formPhone,
          message: formMessage,
          idempotencyKey: messageKeyRef.current,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setFormSubmitted(true);
    } catch {
      setSendError(`Your message did not reach the shop. Please try again, or call or text Paul on ${SHOP_INFO.phone}.`);
    } finally {
      inFlightRef.current = false;
      setSending(false);
    }
  };

  return (
    <section id="contact" className="py-24 bg-white border-t border-zinc-200 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-orange-600 flex items-center justify-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-orange-600" />
            <span>Visit Or Reach Us</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-black text-zinc-900 uppercase italic tracking-tighter">
            LET'S TALK ABOUT <span className="text-orange-600">YOUR RIDE</span>
          </h2>
          <p className="text-zinc-600 text-sm sm:text-base font-normal">
            Have questions about your motorcycle's alignment or frame condition? Give Paul a call, stop by in Spring, TX, or send a message.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start mb-20">
          
          {/* Location & Contact Info Cards */}
          <div className="lg:col-span-5 space-y-6">
            
            <div className="bg-zinc-50 p-6 sm:p-8 rounded-none border border-zinc-200 shadow-sm space-y-6">
              <h3 className="text-xl font-bold text-zinc-900 uppercase border-b border-zinc-200 pb-3 flex items-center justify-between">
                <span>Shop Location &amp; Hours</span>
                <span className="text-xs text-orange-500 font-bold uppercase tracking-wider">Spring, Texas</span>
              </h3>

              <div className="space-y-4 text-sm text-zinc-700">
                
                {/* Phone */}
                <a 
                  href={`tel:${SHOP_INFO.phoneRaw}`}
                  className="flex items-start gap-3 p-3 rounded-none bg-white border border-zinc-200 hover:border-orange-600 transition-all group"
                >
                  <div className="w-10 h-10 rounded-none bg-zinc-50 border border-zinc-200 flex items-center justify-center text-orange-600 flex-shrink-0 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Direct Phone / Text</div>
                    <div className="font-black text-zinc-900 text-lg group-hover:text-orange-500 transition-colors uppercase italic">{SHOP_INFO.phone}</div>
                  </div>
                </a>

                {/* Email */}
                <a
                  href={`mailto:${SHOP_INFO.email}`}
                  className="flex items-start gap-3 p-3 rounded-none bg-white border border-zinc-200 hover:border-orange-600 transition-all group"
                >
                  <div className="w-10 h-10 rounded-none bg-zinc-50 border border-zinc-200 flex items-center justify-center text-orange-600 flex-shrink-0 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Email</div>
                    <div className="font-bold text-zinc-900 break-all group-hover:text-orange-600 transition-colors">{SHOP_INFO.email}</div>
                  </div>
                </a>

                {/* Address */}
                <div className="flex items-start gap-3 p-3 rounded-none bg-white border border-zinc-200">
                  <div className="w-10 h-10 rounded-none bg-zinc-50 border border-zinc-200 flex items-center justify-center text-orange-600 flex-shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Street Address</div>
                    <div className="font-bold text-zinc-900 uppercase">{SHOP_INFO.address}</div>
                  </div>
                </div>

                {/* Hours */}
                <div className="flex items-start gap-3 p-3 rounded-none bg-white border border-zinc-200">
                  <div className="w-10 h-10 rounded-none bg-zinc-50 border border-zinc-200 flex items-center justify-center text-orange-600 flex-shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Operating Hours</div>
                    <div className="font-bold text-zinc-900 uppercase">{SHOP_INFO.hours}</div>
                  </div>
                </div>

                {/* Instagram */}
                <a
                  href={SHOP_INFO.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-none bg-white border border-zinc-200 hover:border-orange-600 transition-all text-xs text-zinc-700 hover:text-white font-bold uppercase tracking-wider"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-none bg-zinc-50 text-orange-500 flex items-center justify-center">
                      <Instagram className="w-4 h-4" />
                    </div>
                    <span>Follow <strong className="text-zinc-900">{SHOP_INFO.instagramHandle}</strong></span>
                  </div>
                  <Send className="w-3.5 h-3.5 text-orange-600" />
                </a>

              </div>
            </div>

            {/* Google Map — loaded only on request, so no Google cookies otherwise. */}
            <div className="rounded-none overflow-hidden border border-zinc-200 shadow-sm h-64 bg-zinc-50">
              <ClickToLoadMap
                embedUrl={SHOP_INFO.mapEmbedUrl}
                address={SHOP_INFO.address}
                title="The Frame Shop Spring TX Location Map"
              />
            </div>

          </div>

          {/* Contact Form */}
          <div className="lg:col-span-7 bg-zinc-50 p-6 sm:p-8 rounded-none border border-zinc-200 shadow-sm">
            <h3 className="text-2xl font-bold text-zinc-900 uppercase mb-2 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-orange-600" />
              <span>Send Paul A Quick Message</span>
            </h3>
            <p className="text-xs text-zinc-600 font-normal mb-6">
              Got a specific question about your bike's handling, frame condition, or custom build geometry? Send us a quick note.
            </p>

            {!formSubmitted ? (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label htmlFor="contact-name" className="block text-xs font-black text-zinc-700 uppercase tracking-widest mb-1">
                    Your Name *
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Dave Miller"
                    required
                    className="w-full bg-white border border-zinc-200 focus:border-orange-600 text-zinc-900 rounded-none p-3 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="contact-reach" className="block text-xs font-black text-zinc-700 uppercase tracking-widest mb-1">
                    Phone or Email *
                  </label>
                  <input
                    id="contact-reach"
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="(832) 555-0199 or rider@example.com"
                    required
                    className="w-full bg-white border border-zinc-200 focus:border-orange-600 text-zinc-900 rounded-none p-3 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-xs font-black text-zinc-700 uppercase tracking-widest mb-1">
                    Message / Motorcycle Details *
                  </label>
                  <textarea
                    id="contact-message"
                    value={formMessage}
                    onChange={(e) => setFormMessage(e.target.value)}
                    placeholder="Tell us about your bike (Year, Make, Model) and what handling issues or alignment work you need..."
                    rows={5}
                    required
                    className="w-full bg-white border border-zinc-200 focus:border-orange-600 text-zinc-900 rounded-none p-3 text-sm focus:outline-none"
                  />
                </div>

                {sendError && (
                  <p role="alert" className="text-sm font-bold text-red-700 bg-red-50 border border-red-200 p-3">
                    {sendError}
                  </p>
                )}

                <p className="text-[11px] text-zinc-600">
                  We use what you send only to reply to you. See our{' '}
                  <a href="/privacy" className="underline hover:text-orange-600">privacy policy</a>.
                </p>

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-60 disabled:cursor-wait text-white font-black py-3.5 rounded-none uppercase tracking-widest text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span>{sending ? 'Sending…' : 'Send Message To Paul'}</span>
                </button>
              </form>
            ) : (
              <div className="text-center py-12 space-y-4 bg-white p-6 rounded-none border border-zinc-200">
                <CheckCircle2 className="w-12 h-12 text-emerald-700 mx-auto" />
                <h4 className="text-xl font-bold text-zinc-900 uppercase">
                  Message Sent To The Shop!
                </h4>
                <p className="text-xs text-zinc-600 max-w-md mx-auto font-normal">
                  Thanks <strong className="text-zinc-900 font-bold">{formName}</strong>. Paul will review your message and reach back out promptly.
                </p>
                <button
                  onClick={() => {
                    setFormSubmitted(false);
                    setFormName('');
                    setFormPhone('');
                    setFormMessage('');
                    messageKeyRef.current = newMessageKey();
                  }}
                  className="text-xs text-orange-500 hover:text-orange-400 uppercase font-bold underline cursor-pointer pt-2 tracking-wider"
                >
                  Send another message
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Frequently Asked Questions */}
        <div className="max-w-4xl mx-auto pt-8 border-t border-zinc-200">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-zinc-900 uppercase">
              FREQUENTLY ASKED QUESTIONS
            </h3>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="bg-zinc-50 border border-zinc-200 rounded-none overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-4 font-black text-sm sm:text-base text-zinc-900 uppercase italic hover:text-orange-500 transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-orange-600 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-5 sm:px-5 text-xs sm:text-sm text-zinc-600 font-normal leading-relaxed border-t border-zinc-200 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
};
