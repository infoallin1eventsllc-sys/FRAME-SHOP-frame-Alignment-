export type BuildStatus = 'Queued' | 'In Progress' | 'Parts Wait' | 'Completed' | 'Delivered';
export type InvoiceStatus = 'Paid' | 'Pending' | 'Overdue' | 'Parts Wait';
export type View = 'dashboard' | 'billing' | 'projects' | 'customers';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  createdAt: string;
}

/** Fields the shop owner fills in when creating a customer. */
export type NewCustomer = Omit<Customer, 'id' | 'createdAt'>;

/** Fields the shop owner fills in when creating a project. */
export type NewProject = Omit<Project, 'id' | 'actualCost' | 'completedDate'> & {
  actualCost?: number;
};

/** Fields the shop owner fills in when creating an invoice. */
export type NewInvoice = Omit<Invoice, 'id' | 'amount' | 'paidAmount' | 'createdAt'> & {
  paidAmount?: number;
};

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  customerId: string;
  projectId: string;
  status: InvoiceStatus;
  amount: number;
  paidAmount: number;
  createdAt: string;
  dueDate: string;
  lineItems: LineItem[];
}

export interface Project {
  id: string;
  customerId: string;
  title: string;
  description: string;
  status: BuildStatus;
  technicianNotes: string;
  estimatedCost: number;
  actualCost: number;
  startDate: string;
  completedDate?: string;
  tags: string[];
}
