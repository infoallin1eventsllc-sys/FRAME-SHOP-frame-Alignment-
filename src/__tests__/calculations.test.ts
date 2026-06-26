import { describe, it, expect } from 'vitest';
import {
  totalBilled,
  totalCollected,
  totalOutstanding,
  countByInvoiceStatus,
  countByBuildStatus,
  activeProjectsValue,
  customerLifetimeSpend,
  overdueInvoices,
  projectsForCustomer,
  invoicesForCustomer,
  calcLineItemTotal,
} from '../utils/calculations';
import { INVOICES, PROJECTS, CUSTOMERS } from '../data/seed';

describe('totalBilled', () => {
  it('sums all invoice amounts', () => {
    expect(totalBilled(INVOICES)).toBe(4380);
  });
  it('returns 0 for empty array', () => {
    expect(totalBilled([])).toBe(0);
  });
});

describe('totalCollected', () => {
  it('sums paidAmount across invoices', () => {
    expect(totalCollected(INVOICES)).toBe(1260);
  });
  it('returns 0 for empty array', () => {
    expect(totalCollected([])).toBe(0);
  });
});

describe('totalOutstanding', () => {
  it('equals billed minus collected', () => {
    expect(totalOutstanding(INVOICES)).toBe(totalBilled(INVOICES) - totalCollected(INVOICES));
  });
  it('equals 3120 for seed data', () => {
    expect(totalOutstanding(INVOICES)).toBe(3120);
  });
});

describe('countByInvoiceStatus', () => {
  it('counts Paid invoices', () => {
    expect(countByInvoiceStatus(INVOICES, 'Paid')).toBe(1);
  });
  it('counts Overdue invoices', () => {
    expect(countByInvoiceStatus(INVOICES, 'Overdue')).toBe(1);
  });
  it('counts Pending invoices', () => {
    expect(countByInvoiceStatus(INVOICES, 'Pending')).toBe(2);
  });
});

describe('countByBuildStatus', () => {
  it('counts In Progress projects', () => {
    expect(countByBuildStatus(PROJECTS, 'In Progress')).toBe(1);
  });
  it('counts Queued projects', () => {
    expect(countByBuildStatus(PROJECTS, 'Queued')).toBe(1);
  });
  it('counts Parts Wait projects', () => {
    expect(countByBuildStatus(PROJECTS, 'Parts Wait')).toBe(1);
  });
});

describe('activeProjectsValue', () => {
  it('sums estimated costs for Queued, In Progress, and Parts Wait', () => {
    expect(activeProjectsValue(PROJECTS)).toBe(6650);
  });
  it('excludes Completed projects', () => {
    const allEstimates = PROJECTS.reduce((s, p) => s + p.estimatedCost, 0);
    expect(activeProjectsValue(PROJECTS)).toBeLessThan(allEstimates);
  });
});

describe('customerLifetimeSpend', () => {
  it('sums lifetime spend across all customers', () => {
    expect(customerLifetimeSpend(CUSTOMERS)).toBe(23000);
  });
  it('returns 0 for empty array', () => {
    expect(customerLifetimeSpend([])).toBe(0);
  });
});

describe('overdueInvoices', () => {
  it('returns only overdue invoices', () => {
    const overdue = overdueInvoices(INVOICES);
    expect(overdue.length).toBe(1);
    expect(overdue[0].id).toBe('inv-003');
  });
  it('returns empty for no overdue invoices', () => {
    expect(overdueInvoices([])).toEqual([]);
  });
});

describe('projectsForCustomer', () => {
  it('filters projects by customer id', () => {
    expect(projectsForCustomer(PROJECTS, 'c1').length).toBe(1);
  });
  it('returns empty for unknown customer', () => {
    expect(projectsForCustomer(PROJECTS, 'c99').length).toBe(0);
  });
});

describe('invoicesForCustomer', () => {
  it('filters invoices by customer id', () => {
    expect(invoicesForCustomer(INVOICES, 'c1').length).toBe(1);
  });
  it('returns empty for unknown customer', () => {
    expect(invoicesForCustomer(INVOICES, 'c99').length).toBe(0);
  });
});

describe('calcLineItemTotal', () => {
  it('multiplies quantity by unitPrice and sums', () => {
    expect(calcLineItemTotal([
      { quantity: 2, unitPrice: 100 },
      { quantity: 1, unitPrice: 50 },
    ])).toBe(250);
  });
  it('handles negative unit prices (credits)', () => {
    expect(calcLineItemTotal([
      { quantity: 3, unitPrice: 100 },
      { quantity: 1, unitPrice: -50 },
    ])).toBe(250);
  });
  it('returns 0 for empty array', () => {
    expect(calcLineItemTotal([])).toBe(0);
  });
});
