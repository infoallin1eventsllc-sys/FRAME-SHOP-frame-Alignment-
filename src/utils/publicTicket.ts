/**
 * What Track Ticket may show to whoever types in a ticket or phone number.
 *
 * Anyone can do that — including someone who only knows a customer's phone
 * number — so this is the whole of what leaves the server: the job, its
 * status, Paul's notes to the customer, and the money owed. Never the email,
 * the full phone number, the customer's own notes, payment records, or the
 * invoice's private owner notes. It used to send the entire booking record.
 */

export interface PublicInvoice {
  invoiceNumber: string;
  subtotal: number;
  shopSuppliesRatePct: number;
  shopSuppliesAmount: number;
  taxRatePct: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: string;
}

export interface PublicTicket {
  ticketNumber: string;
  serviceTitle: string;
  bikeYear: string;
  bikeMake: string;
  bikeModel: string;
  status: string;
  preferredDate: string;
  preferredTimeSlot: string;
  firstName: string;
  phoneLast4: string;
  techNotes?: string;
  createdAt: string;
  invoice?: PublicInvoice;
}

type BookingLike = {
  ticketNumber: string; serviceTitle: string; bikeYear: string; bikeMake: string; bikeModel: string;
  status: string; preferredDate: string; preferredTimeSlot: string; name: string; phone: string;
  techNotes?: string; createdAt: string;
  invoice?: {
    invoiceNumber: string; subtotal: number; shopSuppliesRatePct: number; shopSuppliesAmount: number;
    taxRatePct: number; taxAmount: number; totalAmount: number; amountPaid?: number; paymentStatus: string;
  } | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function publicTicket(b: BookingLike): PublicTicket {
  const inv = b.invoice;
  const paid = round2(inv?.amountPaid ?? 0);
  return {
    ticketNumber: b.ticketNumber,
    serviceTitle: b.serviceTitle,
    bikeYear: b.bikeYear,
    bikeMake: b.bikeMake,
    bikeModel: b.bikeModel,
    status: b.status,
    preferredDate: b.preferredDate,
    preferredTimeSlot: b.preferredTimeSlot,
    firstName: (b.name || '').trim().split(/\s+/)[0] || '',
    phoneLast4: (b.phone || '').replace(/\D/g, '').slice(-4),
    ...(b.techNotes ? { techNotes: b.techNotes } : {}),
    createdAt: b.createdAt,
    ...(inv
      ? {
          invoice: {
            invoiceNumber: inv.invoiceNumber,
            subtotal: inv.subtotal,
            shopSuppliesRatePct: inv.shopSuppliesRatePct,
            shopSuppliesAmount: inv.shopSuppliesAmount,
            taxRatePct: inv.taxRatePct,
            taxAmount: inv.taxAmount,
            totalAmount: inv.totalAmount,
            amountPaid: paid,
            balanceDue: Math.max(0, round2(inv.totalAmount - paid)),
            paymentStatus: inv.paymentStatus,
          },
        }
      : {}),
  };
}
