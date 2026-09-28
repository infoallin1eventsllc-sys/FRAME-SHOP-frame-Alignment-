export interface ServiceItem {
  id: string;
  title: string;
  category: 'core' | 'maintenance' | 'custom';
  shortDesc: string;
  fullDesc: string;
  features: string[];
  estimatedTime: string;
  startingPrice?: string;
  iconName: string;
}

export interface WorkProject {
  id: string;
  title: string;
  category: 'frame' | 'powertrain' | 'suspension' | 'custom';
  bikeModel: string;
  year: string;
  imageUrl: string;
  beforeAfterSpec: {
    laserDeviationBefore: string;
    laserDeviationAfter: string;
    keyFix: string;
  };
  description: string;
}



export interface BookingFormData {
  serviceId: string;
  bikeYear: string;
  bikeMake: string;
  bikeModel: string;
  issueDescription: string;
  preferredDate: string;
  preferredTime: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;
}

export interface DiagnosticAnswer {
  questionId: string;
  optionIndex: number;
}

export interface QuizResult {
  severity: 'low' | 'moderate' | 'critical';
  title: string;
  recommendation: string;
  recommendedServices: string[];
  estimatedTime: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  /** "service" is a flat-priced job from the rate sheet; "labor" is billed by the hour. */
  category: "service" | "labor" | "parts" | "laser_scan" | "supplies" | "sublet";
  quantity: number;
  rate: number;
  amount: number;
}

export interface InternalInvoice {
  invoiceNumber: string;
  createdDate: string;
  dueDate: string;
  mechanicName: string;
  laborHourlyRate: number;
  items: InvoiceLineItem[];
  subtotal: number;
  shopSuppliesRatePct: number;
  shopSuppliesAmount: number;
  taxRatePct: number;
  taxAmount: number;
  totalAmount: number;
  /** Worked out by the server from `payments`. Not something to set by hand. */
  paymentStatus: "unpaid" | "deposit_paid" | "paid_in_full";
  payments?: PaymentRecord[];
  amountPaid?: number;
  internalOwnerNotes?: string;
}

export interface PaymentRecord {
  orderId: string;
  orderName: string;
  amount: number;
  paidAt: string;
  method?: "shopify" | "cash" | "check" | "card_in_person" | "other";
  note?: string;
}

/** Paul's own rates, saved on the server. */
export interface ShopRates {
  laborRate: number | null;
  suppliesPct: number;
  taxPct: number | null;
  overheadPerHour: number | null;
  lines: { id: string; name: string; price: number | null; unit: string; note: string }[];
  confirmedAt?: string;
}

export interface Booking {
  id: string;
  ticketNumber: string;
  serviceId: string;
  serviceTitle: string;
  bikeYear: string;
  bikeMake: string;
  bikeModel: string;
  issueNotes: string;
  preferredDate: string;
  preferredTimeSlot: string;
  name: string;
  phone: string;
  email: string;
  status: "pending" | "confirmed" | "in_shop" | "completed" | "cancelled";
  createdAt: string;
  techNotes?: string;
  invoice?: InternalInvoice;
  /** Paid before an invoice existed (the online deposit). Moves onto the invoice when one is made. */
  prepayments?: PaymentRecord[];
  /** Present only if the customer ticked the offers box when booking. */
  marketingConsent?: { given: true; at: string; wording: string };
}

