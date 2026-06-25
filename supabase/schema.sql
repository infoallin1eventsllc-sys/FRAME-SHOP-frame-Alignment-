-- Run this entire file in your Supabase project:
-- Dashboard → SQL Editor → New query → paste → Run

-- Customers
create table if not exists customers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  phone           text default '',
  email           text default '',
  vehicle         text default '',
  outstanding_balance numeric default 0,
  lifetime_spend  numeric default 0,
  notes           text default '',
  joined_date     date,
  created_at      timestamptz default now()
);

-- Projects / Builds
create table if not exists projects (
  id                   uuid primary key default gen_random_uuid(),
  customer_id          uuid references customers(id) on delete set null,
  title                text not null,
  type                 text default 'Frame Modification',
  status               text default 'Queued',
  estimated_cost       numeric default 0,
  actual_cost          numeric default 0,
  technician_notes     text default '',
  start_date           date,
  estimated_completion date,
  vehicle              text default '',
  created_at           timestamptz default now()
);

-- Invoices
create table if not exists invoices (
  id             uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  customer_id    uuid references customers(id) on delete set null,
  project_id     uuid references projects(id) on delete set null,
  status         text default 'Pending',
  amount         numeric default 0,
  amount_paid    numeric default 0,
  issue_date     date,
  due_date       date,
  created_at     timestamptz default now()
);

-- Line Items
create table if not exists line_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid references invoices(id) on delete cascade,
  description text default '',
  quantity    numeric default 1,
  unit_price  numeric default 0
);

-- Row Level Security
-- Allows all reads and writes via the anon key.
-- Replace these policies with auth-based rules when you add login.
alter table customers  enable row level security;
alter table projects   enable row level security;
alter table invoices   enable row level security;
alter table line_items enable row level security;

create policy "allow all" on customers  for all using (true) with check (true);
create policy "allow all" on projects   for all using (true) with check (true);
create policy "allow all" on invoices   for all using (true) with check (true);
create policy "allow all" on line_items for all using (true) with check (true);
