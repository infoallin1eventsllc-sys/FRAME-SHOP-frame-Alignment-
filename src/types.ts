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

export interface Testimonial {
  id: string;
  riderName: string;
  bikeInfo: string;
  location: string;
  rating: number;
  quote: string;
  verifiedService: string;
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
  category: "labor" | "parts" | "laser_scan" | "supplies" | "sublet";
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
  paymentStatus: "unpaid" | "deposit_paid" | "paid_in_full";
  internalOwnerNotes?: string;
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
}

