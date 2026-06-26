import type { Invoice, Project, Customer, InvoiceStatus, BuildStatus } from '../types';

export function totalBilled(invoices: Invoice[]): number {
  return invoices.reduce((sum, inv) => sum + inv.amount, 0);
}

export function totalCollected(invoices: Invoice[]): number {
  return invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
}

export function totalOutstanding(invoices: Invoice[]): number {
  return invoices.reduce((sum, inv) => sum + (inv.amount - inv.paidAmount), 0);
}

export function countByInvoiceStatus(invoices: Invoice[], status: InvoiceStatus): number {
  return invoices.filter((inv) => inv.status === status).length;
}

export function countByBuildStatus(projects: Project[], status: BuildStatus): number {
  return projects.filter((p) => p.status === status).length;
}

export function activeProjectsValue(projects: Project[]): number {
  const active: BuildStatus[] = ['Queued', 'In Progress', 'Parts Wait'];
  return projects
    .filter((p) => active.includes(p.status))
    .reduce((sum, p) => sum + p.estimatedCost, 0);
}

export function customerLifetimeSpend(customers: Customer[]): number {
  return customers.reduce((sum, c) => sum + c.lifetimeSpend, 0);
}

export function overdueInvoices(invoices: Invoice[]): Invoice[] {
  return invoices.filter((inv) => inv.status === 'Overdue');
}

export function projectsForCustomer(projects: Project[], customerId: string): Project[] {
  return projects.filter((p) => p.customerId === customerId);
}

export function invoicesForCustomer(invoices: Invoice[], customerId: string): Invoice[] {
  return invoices.filter((inv) => inv.customerId === customerId);
}

export function calcLineItemTotal(lineItems: { quantity: number; unitPrice: number }[]): number {
  return lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
}
