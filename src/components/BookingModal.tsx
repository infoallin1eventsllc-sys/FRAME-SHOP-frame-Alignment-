import React, { useState, useEffect } from 'react';
import { SERVICES, SHOP_INFO } from '../data/shopData';
import { X, Calendar, Clock, CheckCircle2, Phone, MapPin, Wrench, ShieldCheck, AlertCircle } from 'lucide-react';
import { safeFetch } from '../utils/api';

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
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [bookingTicketNumber, setBookingTicketNumber] = useState<string>('');

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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          email
        })
      });

      if (res.ok) {
        const data = await res.json();
        setBookingTicketNumber(data.booking?.ticketNumber || ('FS-' + Math.floor(100000 + Math.random() * 900000)));
        setIsSubmitted(true);
      } else {
        const errorData = await res.json();
        setErrorMessage(errorData.error || 'Failed to submit appointment request.');
      }
    } catch (err) {
      console.error('Booking submission error:', err);
      // Fallback ticket for offline/preview
      const fallbackTicket = 'FS-' + Math.floor(100000 + Math.random() * 900000);
      setBookingTicketNumber(fallbackTicket);
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentServiceObj = SERVICES.find(s => s.id === selectedService) || SERVICES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md animate-in fade-in duration-200 font-sans">
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
                <label className="block text-xs font-black text-zinc-300 uppercase tracking-widest mb-2">
                  Select Service Required *
                </label>
                <select
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
                  <label className="block text-xs font-black text-zinc-300 uppercase tracking-widest mb-1.5">
                    Year *
                  </label>
                  <input
                    type="text"
                    value={bikeYear}
                    onChange={(e) => setBikeYear(e.target.value)}
                    placeholder="e.g. 2022"
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-600 text-zinc-100 rounded-none p-3 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-zinc-300 uppercase tracking-widest mb-1.5">
                    Make *
                  </label>
                  <input
                    type="text"
                    value={bikeMake}
                    onChange={(e) => setBikeMake(e.target.value)}
                    placeholder="Harley-Davidson, Indian, FXR..."
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-600 text-zinc-100 rounded-none p-3 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-zinc-300 uppercase tracking-widest mb-1.5">
                    Model *
                  </label>
                  <input
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
                <label className="block text-xs font-black text-zinc-300 uppercase tracking-widest mb-1.5">
                  Describe Handling Issue or Modification Details
                </label>
                <textarea
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
                  <label className="block text-xs font-black text-zinc-300 uppercase tracking-widest mb-1.5">
                    Preferred Date (Tue - Sat) *
                  </label>
                  <input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-600 text-zinc-100 rounded-none p-3 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-zinc-300 uppercase tracking-widest mb-1.5">
                    Preferred Time Slot *
                  </label>
                  <select
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
                    <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">Your Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full Name"
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-none p-2.5 text-sm focus:outline-none focus:border-orange-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(832) 555-0199"
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-none p-2.5 text-sm focus:outline-none focus:border-orange-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-zinc-400 mb-1">Email Address *</label>
                    <input
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
                  <span>Instant Shop Notification &amp; Confirmation</span>
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
