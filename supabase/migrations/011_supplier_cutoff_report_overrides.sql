create table if not exists supplier_cutoff_report_overrides (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  row_kind text not null check (row_kind in ('counter', 'payment')),
  source_key text,
  action text not null check (action in ('hide', 'manual')),
  row_date date,
  reference text,
  delivered numeric(12,2) not null default 0,
  returned numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists supplier_cutoff_overrides_source_idx
  on supplier_cutoff_report_overrides(supplier_id, start_date, end_date, row_kind, source_key)
  where source_key is not null;

create index if not exists supplier_cutoff_overrides_range_idx
  on supplier_cutoff_report_overrides(supplier_id, start_date, end_date);

alter table supplier_cutoff_report_overrides enable row level security;

drop policy if exists "authenticated read" on supplier_cutoff_report_overrides;
drop policy if exists "staff insert" on supplier_cutoff_report_overrides;
drop policy if exists "staff update" on supplier_cutoff_report_overrides;
drop policy if exists "admin delete" on supplier_cutoff_report_overrides;
drop policy if exists "staff delete" on supplier_cutoff_report_overrides;

create policy "authenticated read" on supplier_cutoff_report_overrides
  for select to authenticated using (true);

create policy "staff insert" on supplier_cutoff_report_overrides
  for insert to authenticated with check (public.current_role() in ('admin', 'staff'));

create policy "staff update" on supplier_cutoff_report_overrides
  for update to authenticated using (public.current_role() in ('admin', 'staff')) with check (public.current_role() in ('admin', 'staff'));

create policy "staff delete" on supplier_cutoff_report_overrides
  for delete to authenticated using (public.current_role() in ('admin', 'staff'));
