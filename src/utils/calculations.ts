import type { Invoice, Project, InvoiceStatus, BuildStatus } from '../types';
import { sumMoney, subtractMoney, multiplyMoney } from './money';

export function totalBilled(invoices: Invoice[]): number {
  return sumMoney(invoices.map((inv) => inv.amount));
}

export function totalCollected(invoices: Invoice[]): number {
  return sumMoney(invoices.map((inv) => inv.paidAmount));
}

export function totalOutstanding(invoices: Invoice[]): number {
  return subtractMoney(totalBilled(invoices), totalCollected(invoices));
}

export function countByInvoiceStatus(invoices: Invoice[], status: InvoiceStatus): number {
  return invoices.filter((inv) => inv.status === status).length;
}

export function countByBuildStatus(projects: Project[], status: BuildStatus): number {
  return projects.filter((p) => p.status === status).length;
}

export function activeProjectsValue(projects: Project[]): number {
  const active: BuildStatus[] = ['Queued', 'In Progress', 'Parts Wait'];
  return sumMoney(
    projects.filter((p) => active.includes(p.status)).map((p) => p.estimatedCost),
  );
}

/** Total amount a customer has actually paid, derived from their invoices. */
export function customerLifetimeSpend(invoices: Invoice[], customerId: string): number {
  return sumMoney(
    invoices.filter((inv) => inv.customerId === customerId).map((inv) => inv.paidAmount),
  );
}

/** What a customer currently owes, derived from their invoices. */
export function customerOutstandingBalance(invoices: Invoice[], customerId: string): number {
  const customerInvoices = invoices.filter((inv) => inv.customerId === customerId);
  return subtractMoney(
    sumMoney(customerInvoices.map((inv) => inv.amount)),
    sumMoney(customerInvoices.map((inv) => inv.paidAmount)),
  );
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
  return sumMoney(lineItems.map((li) => multiplyMoney(li.quantity, li.unitPrice)));
}
