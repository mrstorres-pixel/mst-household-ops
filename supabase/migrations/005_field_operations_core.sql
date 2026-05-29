create table if not exists payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  subaccount_id uuid references customer_subaccounts(id) on delete set null,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);

alter table supplier_payments add column if not exists purchase_order_id uuid references purchase_orders(id) on delete set null;
alter table supplier_adjustments add column if not exists purchase_order_id uuid references purchase_orders(id) on delete set null;

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table payment_allocations enable row level security;
alter table audit_logs enable row level security;

drop policy if exists "authenticated read" on payment_allocations;
drop policy if exists "staff insert" on payment_allocations;
drop policy if exists "staff update" on payment_allocations;
drop policy if exists "admin delete" on payment_allocations;
create policy "authenticated read" on payment_allocations for select to authenticated using (true);
create policy "staff insert" on payment_allocations for insert to authenticated with check (public.current_role() in ('admin', 'staff'));
create policy "staff update" on payment_allocations for update to authenticated using (public.current_role() in ('admin', 'staff')) with check (public.current_role() in ('admin', 'staff'));
create policy "admin delete" on payment_allocations for delete to authenticated using (public.current_role() = 'admin');

drop policy if exists "authenticated read" on audit_logs;
drop policy if exists "staff insert" on audit_logs;
drop policy if exists "admin delete" on audit_logs;
create policy "authenticated read" on audit_logs for select to authenticated using (true);
create policy "staff insert" on audit_logs for insert to authenticated with check (public.current_role() in ('admin', 'staff'));
create policy "admin delete" on audit_logs for delete to authenticated using (public.current_role() = 'admin');

create or replace view invoice_payment_status as
select
  i.id as invoice_id,
  i.invoice_number,
  i.customer_id,
  i.subaccount_id,
  i.invoice_date,
  i.total,
  coalesce(sum(pa.amount), 0)::numeric(12,2) as allocated_paid,
  (i.total - coalesce(sum(pa.amount), 0))::numeric(12,2) as remaining_balance
from invoices i
left join payment_allocations pa on pa.invoice_id = i.id
where i.status <> 'void'
group by i.id, i.invoice_number, i.customer_id, i.subaccount_id, i.invoice_date, i.total;
