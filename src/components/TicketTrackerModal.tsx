import React, { useState } from 'react';
import { Search, X, CheckCircle2, Clock, Wrench, AlertCircle, Phone, FileText, Printer, ShieldCheck } from 'lucide-react';
import { SHOP_INFO } from '../data/shopData';
import { safeFetch } from '../utils/api';

interface TicketTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BookingDetails {
  id: string;
  ticketNumber: string;
  serviceTitle: string;
  bikeYear: string;
  bikeMake: string;
  bikeModel: string;
  status: 'pending' | 'confirmed' | 'in_shop' | 'completed' | 'cancelled';
  preferredDate: string;
  preferredTimeSlot: string;
  name: string;
  phone: string;
  techNotes?: string;
  createdAt: string;
  invoice?: {
    invoiceNumber: string;
    subtotal: number;
    shopSuppliesAmount: number;
    taxAmount: number;
    totalAmount: number;
    paymentStatus: string;
  };
}

export const TicketTrackerModal: React.FC<TicketTrackerModalProps> = ({ isOpen, onClose }) => {
  const [ticketInput, setTicketInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [foundBooking, setFoundBooking] = useState<BookingDetails | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketInput.trim()) return;

    setIsLoading(true);
    setErrorMsg('');
    setSearched(true);
    setFoundBooking(null);

    try {
      // The server matches and returns only this customer's booking. It used to
      // send every booking to the browser, which exposed the whole customer list.
      const res = await safeFetch(
        `/api/bookings/lookup?q=${encodeURIComponent(ticketInput.trim())}`
      );

      if (res.ok) {
        const data = await res.json();
        if (data.booking) {
          setFoundBooking(data.booking as BookingDetails);
        } else {
          setErrorMsg(`No active ticket found for "${ticketInput}". Please check your confirmation ticket number or call Paul at ${SHOP_INFO.phone}.`);
        }
      } else if (res.status === 404 || res.status === 400) {
        setErrorMsg(`No active ticket found for "${ticketInput}". Please check your confirmation ticket number or call Paul at ${SHOP_INFO.phone}.`);
      } else if (res.status === 429) {
        setErrorMsg('Too many lookups just now. Wait a moment and try again, or call the shop.');
      } else {
        setErrorMsg('Unable to retrieve tickets right now. Please try again or call the shop.');
      }
    } catch {
      setErrorMsg('Network error. Please call the shop directly for live ticket updates.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: BookingDetails['status']) => {
    switch (status) {
      case 'confirmed':
        return <span className="bg-blue-100 text-blue-800 border border-blue-300 px-3 py-1 text-xs font-black uppercase">Confirmed Appointment</span>;
      case 'in_shop':
        return <span className="bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 text-xs font-black uppercase">Bike In Shop &amp; On Lift</span>;
      case 'completed':
        return <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 text-xs font-black uppercase">Completed &amp; Ready For Pickup</span>;
      case 'cancelled':
        return <span className="bg-rose-100 text-rose-800 border border-rose-300 px-3 py-1 text-xs font-black uppercase">Cancelled</span>;
      default:
        return <span className="bg-zinc-200 text-zinc-800 border border-zinc-300 px-3 py-1 text-xs font-black uppercase">Pending Shop Review</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="bg-white border border-zinc-200 rounded-none max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto text-zinc-900">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-900 rounded-none hover:bg-zinc-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-6 border-b border-zinc-200 pb-4">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-orange-600 flex items-center gap-1.5 mb-1">
            <Wrench className="w-4 h-4 text-orange-600" />
            <span>Live Work Order &amp; Ticket Status</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 uppercase italic tracking-tighter">
            TRACK YOUR <span className="text-orange-600">REPAIR TICKET</span>
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 mt-1">
            Enter your Ticket Number (e.g. <span className="font-mono font-bold text-zinc-900">FS-993102</span>) or phone number to check your motorcycle's alignment status in real-time.
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
            <input
              type="text"
              placeholder="Enter Ticket # (FS-XXXXXX) or Phone"
              value={ticketInput}
              onChange={(e) => setTicketInput(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-300 focus:border-orange-600 pl-9 pr-3 py-2.5 text-sm font-mono font-bold text-zinc-900 outline-none uppercase"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-orange-600 hover:bg-orange-500 text-white font-black px-6 py-2.5 text-xs uppercase tracking-widest cursor-pointer shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? 'Searching...' : 'Track Ticket'}
          </button>
        </form>

        {/* Error Message */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold uppercase tracking-wider flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Found Ticket Result Card */}
        {foundBooking && (
          <div className="bg-zinc-50 border border-zinc-200 p-5 space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 pb-3">
              <div>
                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block">Work Order Ticket</span>
                <span className="text-xl font-black text-orange-600 font-mono italic">{foundBooking.ticketNumber}</span>
              </div>
              <div>{getStatusBadge(foundBooking.status)}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-white p-3 border border-zinc-200 space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Rider / Owner</span>
                <div className="font-black text-zinc-900 text-sm">{foundBooking.name}</div>
                <div className="text-zinc-600 font-mono">{foundBooking.phone}</div>
              </div>

              <div className="bg-white p-3 border border-zinc-200 space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Motorcycle Details</span>
                <div className="font-black text-zinc-900 text-sm">
                  {foundBooking.bikeYear} {foundBooking.bikeMake} {foundBooking.bikeModel}
                </div>
                <div className="text-zinc-600 text-[11px] italic">Zero-Tolerance Frame Target</div>
              </div>

              <div className="bg-white p-3 border border-zinc-200 space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Service Work</span>
                <div className="font-bold text-orange-600">{foundBooking.serviceTitle}</div>
                <div className="text-zinc-500 text-[11px]">Appointment: {foundBooking.preferredDate} ({foundBooking.preferredTimeSlot})</div>
              </div>

              <div className="bg-white p-3 border border-zinc-200 space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Shop Location</span>
                <div className="font-bold text-zinc-900">{SHOP_INFO.address}</div>
                <div className="text-zinc-500 text-[11px]">Spring, TX 77389</div>
              </div>
            </div>

            {/* Tech Notes from Paul */}
            {foundBooking.techNotes && (
              <div className="bg-amber-50 p-4 border border-amber-200 text-xs">
                <div className="font-bold uppercase tracking-widest text-orange-600 mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Head Mechanic Note (Paul Hurey):</span>
                </div>
                <p className="text-zinc-800 italic font-medium">{foundBooking.techNotes}</p>
              </div>
            )}

            {/* Financial Invoice Breakdown if available */}
            {foundBooking.invoice && (
              <div className="bg-white p-4 border border-zinc-200 space-y-2">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                  <span className="text-xs font-black uppercase text-zinc-900">Itemized Work Estimate / Invoice</span>
                  <span className="text-xs font-bold text-orange-600 font-mono">{foundBooking.invoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-600 font-mono">
                  <span>Subtotal Services &amp; Parts:</span>
                  <span>${foundBooking.invoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-600 font-mono">
                  <span>Shop Supplies (7.5%):</span>
                  <span>${foundBooking.invoice.shopSuppliesAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-600 font-mono">
                  <span>Texas Sales Tax (8.25%):</span>
                  <span>${foundBooking.invoice.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-zinc-900 font-mono pt-2 border-t border-zinc-200">
                  <span>Total Amount Due:</span>
                  <span className="text-orange-600">${foundBooking.invoice.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <a
                href={`tel:${SHOP_INFO.phoneRaw}`}
                className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-white font-bold px-4 py-2 text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-orange-500" />
                <span>Call Shop ({SHOP_INFO.phone})</span>
              </a>

              <button
                onClick={() => window.print()}
                className="w-full sm:w-auto bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold px-4 py-2 text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 border border-zinc-300 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-zinc-600" />
                <span>Print Work Ticket</span>
              </button>
            </div>
          </div>
        )}

        {/* Quick Sample Search Help */}
        {!searched && (
          <div className="bg-zinc-50 p-4 border border-zinc-200 text-xs text-zinc-600 space-y-2">
            <span className="font-bold text-zinc-900 uppercase tracking-wider block">Sample Test Tickets:</span>
            <div className="flex flex-wrap gap-2 font-mono">
              <button
                type="button"
                onClick={() => setTicketInput('FS-993102')}
                className="bg-white border border-zinc-300 hover:border-orange-600 text-zinc-900 px-2 py-1 text-[11px] font-bold cursor-pointer"
              >
                FS-993102 (Sample Completed)
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
