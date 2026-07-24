import { describe, it, expect } from 'vitest';
import {
  totalBilled,
  totalCollected,
  totalOutstanding,
  countByInvoiceStatus,
  countByBuildStatus,
  activeProjectsValue,
  customerLifetimeSpend,
  customerOutstandingBalance,
  overdueInvoices,
  projectsForCustomer,
  invoicesForCustomer,
  calcLineItemTotal,
} from '../utils/calculations';
import type { Invoice, Project } from '../types';

// Local fixtures — the app itself ships with zero seed data (a fresh
// install starts empty), but tests still need representative sample rows.
const INVOICES: Invoice[] = [
  {
    id: 'inv-001',
    customerId: 'c1',
    projectId: 'p1',
    status: 'Pending',
    amount: 2800,
    paidAmount: 950,
    createdAt: '2024-11-20',
    dueDate: '2024-12-20',
    lineItems: [
      { description: 'Subframe connectors — labor (8h)', quantity: 8, unitPrice: 125 },
      { description: 'Floor patch panels — material', quantity: 2, unitPrice: 285 },
      { description: 'TIG welding — labor (6h)', quantity: 6, unitPrice: 150 },
      { description: 'Shop supplies & consumables', quantity: 1, unitPrice: 70 },
    ],
  },
  {
    id: 'inv-002',
    customerId: 'c2',
    projectId: 'p2',
    status: 'Paid',
    amount: 310,
    paidAmount: 310,
    createdAt: '2024-10-11',
    dueDate: '2024-10-25',
    lineItems: [
      { description: 'Hunter alignment', quantity: 1, unitPrice: 120 },
      { description: 'Outer tie rods — parts (pair)', quantity: 2, unitPrice: 45 },
      { description: 'Tie rod replacement — labor', quantity: 1, unitPrice: 100 },
    ],
  },
  {
    id: 'inv-003',
    customerId: 'c3',
    projectId: 'p3',
    status: 'Overdue',
    amount: 620,
    paidAmount: 0,
    createdAt: '2024-11-01',
    dueDate: '2024-11-15',
    lineItems: [
      { description: 'Disassembly & inspection — labor (2h)', quantity: 2, unitPrice: 125 },
      { description: 'Shop supplies', quantity: 1, unitPrice: 45 },
      { description: 'Storage fee (2 weeks)', quantity: 2, unitPrice: 175 },
    ],
  },
  {
    id: 'inv-004',
    customerId: 'c4',
    projectId: 'p4',
    status: 'Pending',
    amount: 650,
    paidAmount: 0,
    createdAt: '2024-11-28',
    dueDate: '2024-12-15',
    lineItems: [
      { description: 'CNC notch — labor (4h)', quantity: 4, unitPrice: 125 },
      { description: 'Material & consumables', quantity: 1, unitPrice: 150 },
    ],
  },
];

const PROJECTS: Project[] = [
  {
    id: 'p1',
    customerId: 'c1',
    title: '1969 Chevelle Full Frame Swap',
    description: 'Complete subframe connector install, floor patch panels, TIG weld seams.',
    status: 'In Progress',
    technicianNotes: 'Left rocker is worse than expected — added 3hr to estimate.',
    estimatedCost: 4200,
    actualCost: 2800,
    startDate: '2024-11-01',
    tags: ['TIG', 'Frame', 'Patch Panels'],
  },
  {
    id: 'p2',
    customerId: 'c2',
    title: 'F-150 Alignment & Tie Rod Replacement',
    description: 'Hunter alignment + replace both outer tie rods.',
    status: 'Completed',
    technicianNotes: 'Came in 45 min under estimate.',
    estimatedCost: 380,
    actualCost: 310,
    startDate: '2024-10-10',
    completedDate: '2024-10-11',
    tags: ['Alignment', 'Steering'],
  },
  {
    id: 'p3',
    customerId: 'c3',
    title: 'Mustang Tubular K-Member Install',
    description: 'Remove factory K-member, install Maximum Motorsports tubular unit, re-align.',
    status: 'Parts Wait',
    technicianNotes: 'Waiting on MM K-member — ETA 12/3.',
    estimatedCost: 1800,
    actualCost: 0,
    startDate: '2024-11-15',
    tags: ['Frame', 'Alignment', 'Performance'],
  },
  {
    id: 'p4',
    customerId: 'c4',
    title: 'CNC Notch — Rear Framerail',
    description: '3-inch notch on both rear framerails for a 4-inch drop.',
    status: 'Queued',
    technicianNotes: '',
    estimatedCost: 650,
    actualCost: 0,
    startDate: '2024-12-01',
    tags: ['CNC', 'Frame'],
  },
];

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
  it('equals 3120 for sample data', () => {
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
  it('sums a single customer paidAmount across their invoices', () => {
    expect(customerLifetimeSpend(INVOICES, 'c2')).toBe(310);
  });
  it('is derived from invoices, not a stored field, so it never drifts', () => {
    // c1 has one invoice, paid 950 of 2800 — lifetime spend is what they've
    // actually paid so far, recalculated live from the invoice list.
    expect(customerLifetimeSpend(INVOICES, 'c1')).toBe(950);
  });
  it('returns 0 for a customer with no invoices', () => {
    expect(customerLifetimeSpend(INVOICES, 'c99')).toBe(0);
  });
});

describe('customerOutstandingBalance', () => {
  it('equals amount minus paid for a customer', () => {
    expect(customerOutstandingBalance(INVOICES, 'c1')).toBe(1850);
  });
  it('is 0 once fully paid', () => {
    expect(customerOutstandingBalance(INVOICES, 'c2')).toBe(0);
  });
  it('returns 0 for a customer with no invoices', () => {
    expect(customerOutstandingBalance(INVOICES, 'c99')).toBe(0);
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
  it('avoids floating point drift on classic problem values', () => {
    // Plain JS float math: 0.1 + 0.2 = 0.30000000000000004.
    // Three line items of $0.10, $0.10, $0.10 must total exactly $0.30.
    expect(calcLineItemTotal([
      { quantity: 1, unitPrice: 0.1 },
      { quantity: 1, unitPrice: 0.1 },
      { quantity: 1, unitPrice: 0.1 },
    ])).toBe(0.3);
  });
  it('handles fractional hourly quantities without rounding error', () => {
    // 2.15 hours at $85.37/hr — a naive float multiply can land a cent off.
    expect(calcLineItemTotal([{ quantity: 2.15, unitPrice: 85.37 }])).toBeCloseTo(183.55, 2);
  });
});
