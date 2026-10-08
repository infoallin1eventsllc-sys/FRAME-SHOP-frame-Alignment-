import React, { useState, useEffect, useRef } from 'react';
import { SERVICES, SHOP_INFO } from '../data/shopData';
import { X, Calendar, Clock, CheckCircle2, Phone, MapPin, Wrench, ShieldCheck, AlertCircle } from 'lucide-react';
import { safeFetch } from '../utils/api';

const NOT_CONFIRMED =
  `We couldn't confirm your booking — it may not have reached the shop. ` +
  `Please try again, or call Paul on ${SHOP_INFO.phone}.`;

/** crypto.randomUUID needs a secure context; fall back rather than fail. */
/** Shown beside the box and saved with the booking, word for word. */
export const MARKETING_CONSENT_TEXT =
  'Send me occasional offers and shop news from The Frame Shop by email or text. I can opt out at any time.';

function newBookingKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
import { useEscapeToClose, useBackdropClose } from '../utils/useModalClose';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedServiceId?: string;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  preSelectedServiceId = 'powertrain-alignment'
}) => {
  const [selectedService, setSelectedService] = useState<string>(preSelectedServiceId);
  const [bikeYear, setBikeYear] = useState<string>('2021');
  const [bikeMake, setBikeMake] = useState<string>('Harley-Davidson');
  const [bikeModel, setBikeModel] = useState<string>('Road Glide');
  const [issueNotes, setIssueNotes] = useState<string>('');
  const [preferredDate, setPreferredDate] = useState<string>('');
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<string>('Morning (9AM - 12PM)');
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  // Off unless the customer turns it on. A booking is not permission to market.
  const [marketingConsent, setMarketingConsent] = useState<boolean>(false);
  // Optional. Tells Paul which of his marketing actually brings people in.
  const [source, setSource] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [bookingTicketNumber, setBookingTicketNumber] = useState<string>('');
  const [bookingId, setBookingId] = useState<string>('');
  const [depositLoading, setDepositLoading] = useState<boolean>(false);

  useEffect(() => {
    if (preSelectedServiceId) {
      setSelectedService(preSelectedServiceId);
    }
    // Set default preferred date to next Tuesday
    const today = new Date();
    const resultDate = new Date();
    resultDate.setDate(today.getDate() + ((2 + 7 - today.getDay()) % 7 || 7));
    setPreferredDate(resultDate.toISOString().split('T')[0]);
  }, [preSelectedServiceId, isOpen]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  /**
   * One key per booking attempt, sent with every submit of it. The server
   * treats a repeat of the same key as the same booking and hands back the one
   * it already saved. That is what makes "try again" safe after a dropped
   * connection: if the first request landed and only the reply was lost, the
   * retry returns that booking instead of creating a second one.
   */
  const bookingKeyRef = useRef<string>('');
  useEffect(() => {
    if (isOpen) {
      bookingKeyRef.current = newBookingKey();
      setMarketingConsent(false);
      setSource('');
    }
  }, [isOpen]);

  /**
   * isSubmitting disables the button, but only on the next render — two taps
   * inside that gap both reach handleSubmit. A ref is read synchronously, so the
   * second tap sees the first one in flight and stops.
   */
  const inFlightRef = useRef(false);

  useEscapeToClose(isOpen, onClose);
  const onBackdrop = useBackdropClose(onClose);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const currentSvc = SERVICES.find(s => s.id === selectedService) || SERVICES[0];
      const res = await safeFetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService,
          serviceTitle: currentSvc.title,
          bikeYear,
          bikeMake,
          bikeModel,
          issueNotes,
          preferredDate,
          preferredTimeSlot,
          name,
          phone,
          email,
          idempotencyKey: bookingKeyRef.current,
          marketingConsent,
          ...(source ? { source } : {}),
          // Stored with the booking, so there is a record of exactly what was agreed to.
          ...(marketingConsent ? { marketingConsentWording: MARKETING_CONSENT_TEXT } : {}),
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.booking?.ticketNumber) {
        setBookingTicketNumber(data.booking.ticketNumber);
        setBookingId(data.booking.id || '');
        setIsSubmitted(true);
      } else if (res.ok) {
        // Saved, but no ticket came back to show. Never invent one.
        setErrorMessage(NOT_CONFIRMED);
      } else {
        setErrorMessage(data.error || NOT_CONFIRMED);
      }
    } catch {
      // This used to show a confirmed booking with a random, made-up ticket
      // number — so a customer whose request never reached the shop believed
      // they were booked, and turned up to a shop with no record of them.
      // Say plainly that it did not go through. Trying again is safe: the same
      // booking key means a request that did land is returned, not duplicated.
      setErrorMessage(NOT_CONFIRMED);
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handlePayDeposit = async () => {
    setDepositLoading(true);
    try {
      const res = await safeFetch('/api/shopify/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          amount: 75,
          description: `$75 Inspection Deposit – ${currentServiceObj.title} (${bookingTicketNumber})`,
          customerEmail: email,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Could not start payment. Please call the shop.');
      }
    } catch {
      alert('Connection error. Please call the shop to pay your deposit.');
    } finally {
      setDepositLoading(false);
    }
  };

  const currentServiceObj = SERVICES.find(s => s.id === selectedService) || SERVICES[0];

  return (
    <div onMouseDown={onBackdrop} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="bg-zinc-900 border border-zinc-800 rounded-none max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-none hover:bg-zinc-800 transition-colors"
          aria-label="Close Modal"
        >
          <X className="w-5 h-5" />
        </button>

        {!isSubmitted ? (
          <div>
            {/* Modal Header */}
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-[0.3em] text-orange-600 flex items-center gap-1.5 mb-2">
                <Calendar className="w-3.5 h-3.5" />
                <span>By Appointment Only</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-zinc-100 uppercase italic tracking-tighter">
                SCHEDULE <span className="text-orange-600">APPOINTMENT</span>
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 font-normal mt-1">
                Select your service, tell us about your bike, and pick your preferred time slot for a zero-tolerance inspection.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Service Selection */}
              <div>
                <label htmlFor="booking-service" className="block text-xs font-black text-zinc-300 uppercase tracking-widest mb-2">
                  Select Service Required *
                </label>
                <select
                      id="booking-service"
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-600 text-zinc-100 rounded-none p-3 text-sm focus:outline-none"
                  required
                >
                  {SERVICES.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bike Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="booking-year" className="block text-xs font-black text-zinc-300 uppercase tracking-widest mb-1.5">
                    Year *
                  </label>
                  <input
                      id="booking-year"
                    type="text"
                    value={bikeYear}
                    onChange={(e) => setBikeYear(e.target.value)}
                    placeholder="e.g. 2022"
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-600 text-zinc-100 rounded-none p-3 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="booking-make" className="block text-xs font-black text-zinc-300 uppercase tracking-widest mb-1.5">
                    Make *
                  </label>
                  <input
                      id="booking-make"
                    type="text"
                    value={bikeMake}
                    onChange={(e) => setBikeMake(e.target.value)}
                    placeholder="Harley-Davidson, Indian, FXR..."
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-600 text-zinc-100 rounded-none p-3 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="booking-model" className="block text-xs font-black text-zinc-300 uppercase tracking-widest mb-1.5">
                    Model *
                  </label>
                  <input
                      id="booking-model"
                    type="text"
                    value={bikeModel}
                    onChange={(e) => setBikeModel(e.target.value)}
                    placeholder="Road Glide, Chief, Chopper..."
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-600 text-zinc-100 rounded-none p-3 text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Symptoms / Issue Notes */}
              <div>
                <label htmlFor="booking-notes" className="block text-xs font-black text-zinc-300 uppercase tracking-widest mb-1.5">
                  Describe Handling Issue or Modification Details
                </label>
                <textarea
                      id="booking-notes"
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                  placeholder="e.g., High-speed wobble above 70mph, pulls left, or recently installed 124ci engine kit..."
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-600 text-zinc-100 rounded-none p-3 text-sm focus:outline-none"
                />
              </div>

              {/* Preferred Date & Time Slot Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="booking-date" className="block text-xs font-black text-zinc-300 uppercase tracking-widest mb-1.5">
                    Preferred Date (Tue - Sat) *
                  </label>
                  <input
                      id="booking-date"
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-600 text-zinc-100 rounded-none p-3 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="booking-time" className="block text-xs font-black text-zinc-300 uppercase tracking-widest mb-1.5">
                    Preferred Time Slot *
                  </label>
                  <select
                      id="booking-time"
                    value={preferredTimeSlot}
                    onChange={(e) => setPreferredTimeSlot(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-600 text-zinc-100 rounded-none p-3 text-sm focus:outline-none"
                    required
                  >
                    <option value="Morning (9AM - 12PM)">Morning (9AM - 12PM)</option>
                    <option value="Mid-Day (12PM - 3PM)">Mid-Day (12PM - 3PM)</option>
                    <option value="Late Afternoon (3PM - 5PM)">Late Afternoon (3PM - 5PM)</option>
                  </select>
                </div>
              </div>

              {/* Contact Info */}
              <div className="pt-2 border-t border-zinc-800 space-y-3">
                <div className="text-xs font-black uppercase text-orange-500 tracking-widest">
                  Contact Information
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="booking-name" className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">Your Name *</label>
                    <input
                      id="booking-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full Name"
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-none p-2.5 text-sm focus:outline-none focus:border-orange-600"
                    />
                  </div>

                  <div>
                    <label htmlFor="booking-phone" className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">Phone Number *</label>
                    <input
                      id="booking-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(832) 555-0199"
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-none p-2.5 text-sm focus:outline-none focus:border-orange-600"
                    />
                  </div>

                  <div>
                    <label htmlFor="booking-email" className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">Email Address *</label>
                    <input
                      id="booking-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="rider@example.com"
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-none p-2.5 text-sm focus:outline-none focus:border-orange-600"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="booking-source" className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">
                  How did you hear about us? <span className="normal-case font-normal text-zinc-500">(optional)</span>
                </label>
                <select
                  id="booking-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full sm:w-72 bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-none p-2.5 text-sm focus:outline-none focus:border-orange-600"
                >
                  <option value="">Choose one…</option>
                  {['Google search', 'Google Maps', 'Instagram', 'Facebook', 'TikTok', 'Friend or another rider', 'Returning customer', 'Saw the shop', 'Other'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="booking-marketing" className="flex items-start gap-2.5 text-xs text-zinc-300 cursor-pointer">
                  <input
                    id="booking-marketing"
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-orange-600 flex-shrink-0"
                  />
                  <span>{MARKETING_CONSENT_TEXT} <span className="text-zinc-500">(Optional — not needed to book.)</span></span>
                </label>
                <p className="text-[11px] text-zinc-400">
                  We use your details to arrange and carry out this job. See our{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-400">privacy policy</a>
                  {' '}and{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-400">terms</a>.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-950/80 border border-red-600/60 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Controls */}
              <div className="pt-4 border-t border-zinc-800 flex items-center justify-between flex-wrap gap-3">
                <div className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
                  <span>Paul reviews every request and gets back to you</span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 text-white font-black px-8 py-3 rounded-none uppercase tracking-widest text-xs flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Sending Request...' : 'Confirm Booking Request'}</span>
                </button>
              </div>

            </form>
          </div>
        ) : (
          /* Confirmation Screen */
          <div className="text-center py-6 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-zinc-950 text-emerald-500 border border-zinc-800 rounded-none flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-orange-500 bg-zinc-950 px-3 py-1 rounded-none border border-zinc-800">
                Ticket #{bookingTicketNumber}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-zinc-100 uppercase italic tracking-tighter mt-3">
                APPOINTMENT REQUEST RECEIVED!
              </h2>
              <p className="text-zinc-400 text-sm max-w-md mx-auto font-normal mt-2">
                Thank you, <strong className="text-zinc-100 font-bold">{name}</strong>. Paul has received your request for <strong className="text-orange-500">{currentServiceObj.title}</strong> on your <strong className="text-zinc-100">{bikeYear} {bikeMake} {bikeModel}</strong>.
              </p>
            </div>

            {/* Ticket Summary Card */}
            <div className="bg-zinc-950 p-5 rounded-none border border-zinc-800 text-left text-xs space-y-2 max-w-lg mx-auto">
              <div className="flex justify-between border-b border-zinc-900 pb-2">
                <span className="text-zinc-500 uppercase font-bold tracking-wider">Requested Date &amp; Time:</span>
                <span className="text-zinc-100 font-bold">{preferredDate} ({preferredTimeSlot})</span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-2">
                <span className="text-zinc-500 uppercase font-bold tracking-wider">Shop Location:</span>
                <span className="text-zinc-100 font-bold">{SHOP_INFO.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 uppercase font-bold tracking-wider">Contact Phone:</span>
                <span className="text-orange-500 font-bold">{phone}</span>
              </div>
            </div>

            {/* Optional deposit payment */}
            <div className="bg-zinc-950 border border-orange-600/40 p-4 rounded-none max-w-lg mx-auto text-left">
              <div className="text-[11px] font-black uppercase tracking-widest text-orange-500 mb-1">
                Secure Your Appointment
              </div>
              <p className="text-xs text-zinc-400 mb-3">
                Speed up your lift time by paying your <strong className="text-zinc-100">$75 inspection deposit</strong> now. Paul will see your payment and prioritize your slot.
              </p>
              <button
                type="button"
                onClick={handlePayDeposit}
                disabled={depositLoading}
                className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-800 text-white font-black px-4 py-2.5 text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {depositLoading ? 'Redirecting to Payment...' : '💳 Pay $75 Deposit Now'}
              </button>
              <p className="text-[10px] text-zinc-400 mt-2 text-center">
                Secure checkout. No account required.{' '}
                <a href="/refunds" target="_blank" rel="noopener noreferrer" className="underline hover:text-orange-400">Deposit &amp; refund terms</a>
              </p>
            </div>

            <div className="p-4 rounded-none bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 text-left max-w-lg mx-auto flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-100 uppercase font-bold">Next Step:</strong> Paul will review your motorcycle details and call or text you at <strong className="text-zinc-100">{phone}</strong> to confirm your exact lift time slot.
              </div>
            </div>

            <div className="pt-4 flex items-center justify-center gap-3">
              <a
                href={`tel:${SHOP_INFO.phoneRaw}`}
                className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-100 font-bold px-5 py-2.5 rounded-none text-xs uppercase tracking-widest flex items-center gap-1.5 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-orange-600" />
                <span>Call Shop ({SHOP_INFO.phone})</span>
              </a>

              <button
                onClick={() => {
                  setIsSubmitted(false);
                  onClose();
                }}
                className="bg-orange-600 hover:bg-orange-500 text-white font-black px-6 py-2.5 rounded-none text-xs uppercase tracking-widest cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
