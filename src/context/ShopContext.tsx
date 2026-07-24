import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Customer, Invoice, Project, NewCustomer, NewProject, NewInvoice } from '../types';
import { generateId } from '../utils/id';
import { loadFromStorage, saveToStorage } from '../utils/storage';
import { calcLineItemTotal } from '../utils/calculations';
import { addMoney, clampMoney } from '../utils/money';

interface ShopContextType {
  customers: Customer[];
  projects: Project[];
  invoices: Invoice[];

  addCustomer: (data: NewCustomer) => Customer;
  updateCustomer: (id: string, data: Partial<NewCustomer>) => void;
  deleteCustomer: (id: string) => { ok: boolean; reason?: string };

  addProject: (data: NewProject) => Project;
  updateProject: (id: string, data: Partial<NewProject>) => void;
  deleteProject: (id: string) => { ok: boolean; reason?: string };

  addInvoice: (data: NewInvoice) => Invoice;
  updateInvoice: (id: string, data: Partial<Omit<Invoice, 'id'>>) => void;
  deleteInvoice: (id: string) => void;
  recordPayment: (id: string, amount: number) => void;
}

const ShopContext = createContext<ShopContextType | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  // No seed/demo data — a fresh install starts completely empty, and
  // everything persists to the browser's localStorage from here on.
  const [customers, setCustomers] = useState<Customer[]>(() =>
    loadFromStorage<Customer[]>('customers', []),
  );
  const [projects, setProjects] = useState<Project[]>(() =>
    loadFromStorage<Project[]>('projects', []),
  );
  const [invoices, setInvoices] = useState<Invoice[]>(() =>
    loadFromStorage<Invoice[]>('invoices', []),
  );

  useEffect(() => saveToStorage('customers', customers), [customers]);
  useEffect(() => saveToStorage('projects', projects), [projects]);
  useEffect(() => saveToStorage('invoices', invoices), [invoices]);

  function addCustomer(data: NewCustomer): Customer {
    // IDs are generated independently of how many records exist, so
    // deleting customers never causes a future ID to collide with one
    // still referenced by a project or invoice.
    const customer: Customer = { ...data, id: generateId('cus'), createdAt: new Date().toISOString().slice(0, 10) };
    setCustomers((prev) => [...prev, customer]);
    return customer;
  }

  function updateCustomer(id: string, data: Partial<NewCustomer>) {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
  }

  function deleteCustomer(id: string): { ok: boolean; reason?: string } {
    const hasProjects = projects.some((p) => p.customerId === id);
    const hasInvoices = invoices.some((inv) => inv.customerId === id);
    if (hasProjects || hasInvoices) {
      return {
        ok: false,
        reason: 'This customer has projects or invoices on file. Remove or reassign those first.',
      };
    }
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    return { ok: true };
  }

  function addProject(data: NewProject): Project {
    const project: Project = { ...data, actualCost: data.actualCost ?? 0, id: generateId('prj') };
    setProjects((prev) => [...prev, project]);
    return project;
  }

  function updateProject(id: string, data: Partial<NewProject>) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
  }

  function deleteProject(id: string): { ok: boolean; reason?: string } {
    const hasInvoices = invoices.some((inv) => inv.projectId === id);
    if (hasInvoices) {
      return {
        ok: false,
        reason: 'This project has invoices on file. Remove or reassign those invoices first.',
      };
    }
    setProjects((prev) => prev.filter((p) => p.id !== id));
    return { ok: true };
  }

  function addInvoice(data: NewInvoice): Invoice {
    const amount = calcLineItemTotal(data.lineItems);
    const invoice: Invoice = {
      ...data,
      amount,
      paidAmount: clampMoney(data.paidAmount ?? 0),
      id: generateId('inv'),
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setInvoices((prev) => [...prev, invoice]);
    return invoice;
  }

  function updateInvoice(id: string, data: Partial<Omit<Invoice, 'id'>>) {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== id) return inv;
        const next = { ...inv, ...data };
        // If line items changed, the invoice amount must be recalculated
        // from them rather than trusted as a separately-edited number.
        if (data.lineItems) next.amount = calcLineItemTotal(next.lineItems);
        return next;
      }),
    );
  }

  function deleteInvoice(id: string) {
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
  }

  function recordPayment(id: string, amount: number) {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id !== id) return inv;
        const paidAmount = clampMoney(Math.min(addMoney(inv.paidAmount, amount), inv.amount));
        const status = paidAmount >= inv.amount ? 'Paid' : inv.status;
        return { ...inv, paidAmount, status };
      }),
    );
  }

  return (
    <ShopContext.Provider
      value={{
        customers,
        projects,
        invoices,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        addProject,
        updateProject,
        deleteProject,
        addInvoice,
        updateInvoice,
        deleteInvoice,
        recordPayment,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
}

export function useShop(): ShopContextType {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used within ShopProvider');
  return ctx;
}
