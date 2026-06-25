import { supabase } from './supabase';
import type { Customer, Project, Invoice, LineItem } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function toCustomer(r: Row): Customer {
  return {
    id: r.id,
    name: r.name ?? '',
    phone: r.phone ?? '',
    email: r.email ?? '',
    vehicle: r.vehicle ?? '',
    outstandingBalance: r.outstanding_balance ?? 0,
    lifetimeSpend: r.lifetime_spend ?? 0,
    notes: r.notes ?? '',
    joinedDate: r.joined_date ?? '',
  };
}

function toProject(r: Row): Project {
  return {
    id: r.id,
    customerId: r.customer_id ?? '',
    title: r.title ?? '',
    type: r.type,
    status: r.status,
    estimatedCost: r.estimated_cost ?? 0,
    actualCost: r.actual_cost ?? 0,
    technicianNotes: r.technician_notes ?? '',
    startDate: r.start_date ?? '',
    estimatedCompletion: r.estimated_completion ?? '',
    vehicle: r.vehicle ?? '',
  };
}

function toLineItem(r: Row): LineItem {
  return {
    id: r.id,
    description: r.description ?? '',
    quantity: r.quantity ?? 1,
    unitPrice: r.unit_price ?? 0,
  };
}

function toInvoice(r: Row, lineItems: LineItem[]): Invoice {
  return {
    id: r.id,
    invoiceNumber: r.invoice_number ?? '',
    customerId: r.customer_id ?? '',
    projectId: r.project_id ?? '',
    status: r.status,
    amount: r.amount ?? 0,
    amountPaid: r.amount_paid ?? 0,
    issueDate: r.issue_date ?? '',
    dueDate: r.due_date ?? '',
    lineItems,
  };
}

// ── Customers ─────────────────────────────────────────────────────────────────

export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toCustomer);
}

export async function insertCustomer(c: Customer): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      name: c.name,
      phone: c.phone,
      email: c.email,
      vehicle: c.vehicle,
      outstanding_balance: c.outstandingBalance,
      lifetime_spend: c.lifetimeSpend,
      notes: c.notes,
      joined_date: c.joinedDate || null,
    })
    .select()
    .single();
  if (error) throw error;
  return toCustomer(data);
}

export async function updateCustomer(c: Customer): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update({
      name: c.name,
      phone: c.phone,
      email: c.email,
      vehicle: c.vehicle,
      outstanding_balance: c.outstandingBalance,
      lifetime_spend: c.lifetimeSpend,
      notes: c.notes,
      joined_date: c.joinedDate || null,
    })
    .eq('id', c.id)
    .select()
    .single();
  if (error) throw error;
  return toCustomer(data);
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toProject);
}

export async function insertProject(p: Project): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      customer_id: p.customerId || null,
      title: p.title,
      type: p.type,
      status: p.status,
      estimated_cost: p.estimatedCost,
      actual_cost: p.actualCost,
      technician_notes: p.technicianNotes,
      start_date: p.startDate || null,
      estimated_completion: p.estimatedCompletion || null,
      vehicle: p.vehicle,
    })
    .select()
    .single();
  if (error) throw error;
  return toProject(data);
}

export async function updateProject(p: Project): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({
      customer_id: p.customerId || null,
      title: p.title,
      type: p.type,
      status: p.status,
      estimated_cost: p.estimatedCost,
      actual_cost: p.actualCost,
      technician_notes: p.technicianNotes,
      start_date: p.startDate || null,
      estimated_completion: p.estimatedCompletion || null,
      vehicle: p.vehicle,
    })
    .eq('id', p.id)
    .select()
    .single();
  if (error) throw error;
  return toProject(data);
}

// ── Invoices ──────────────────────────────────────────────────────────────────

export async function fetchInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, line_items(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(row => {
    const items = (row.line_items ?? []).map(toLineItem);
    return toInvoice(row, items);
  });
}

export async function insertInvoice(inv: Invoice): Promise<Invoice> {
  const { data: row, error } = await supabase
    .from('invoices')
    .insert({
      invoice_number: inv.invoiceNumber,
      customer_id: inv.customerId || null,
      project_id: inv.projectId || null,
      status: inv.status,
      amount: inv.amount,
      amount_paid: inv.amountPaid,
      issue_date: inv.issueDate || null,
      due_date: inv.dueDate || null,
    })
    .select()
    .single();
  if (error) throw error;

  if (inv.lineItems.length > 0) {
    const { error: liErr } = await supabase.from('line_items').insert(
      inv.lineItems.map(li => ({
        invoice_id: row.id,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unitPrice,
      }))
    );
    if (liErr) throw liErr;
  }

  const { data: full, error: fullErr } = await supabase
    .from('invoices')
    .select('*, line_items(*)')
    .eq('id', row.id)
    .single();
  if (fullErr) throw fullErr;
  return toInvoice(full, (full.line_items ?? []).map(toLineItem));
}

export async function updateInvoice(inv: Invoice): Promise<Invoice> {
  const { error } = await supabase
    .from('invoices')
    .update({
      invoice_number: inv.invoiceNumber,
      customer_id: inv.customerId || null,
      project_id: inv.projectId || null,
      status: inv.status,
      amount: inv.amount,
      amount_paid: inv.amountPaid,
      issue_date: inv.issueDate || null,
      due_date: inv.dueDate || null,
    })
    .eq('id', inv.id);
  if (error) throw error;

  await supabase.from('line_items').delete().eq('invoice_id', inv.id);
  if (inv.lineItems.length > 0) {
    await supabase.from('line_items').insert(
      inv.lineItems.map(li => ({
        invoice_id: inv.id,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unitPrice,
      }))
    );
  }

  const { data: full, error: fullErr } = await supabase
    .from('invoices')
    .select('*, line_items(*)')
    .eq('id', inv.id)
    .single();
  if (fullErr) throw fullErr;
  return toInvoice(full, (full.line_items ?? []).map(toLineItem));
}
