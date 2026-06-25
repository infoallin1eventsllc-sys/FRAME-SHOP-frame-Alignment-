export type ProjectType =
  | 'Frame Modification'
  | 'TIG Welding'
  | 'CNC Work'
  | 'Alignment'
  | 'General Repair';

export type ProjectStatus =
  | 'Queued'
  | 'In Progress'
  | 'Parts Wait'
  | 'Completed'
  | 'Delivered';

export type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue' | 'Parts Wait';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  outstandingBalance: number;
  lifetimeSpend: number;
  notes: string;
  joinedDate: string;
}

export interface Project {
  id: string;
  customerId: string;
  title: string;
  type: ProjectType;
  status: ProjectStatus;
  estimatedCost: number;
  actualCost: number;
  technicianNotes: string;
  startDate: string;
  estimatedCompletion: string;
  vehicle: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  projectId: string;
  status: InvoiceStatus;
  amount: number;
  amountPaid: number;
  issueDate: string;
  dueDate: string;
  lineItems: LineItem[];
}

export type View = 'dashboard' | 'billing' | 'projects' | 'customers';
