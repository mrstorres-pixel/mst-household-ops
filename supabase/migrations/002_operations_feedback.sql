create table if not exists app_files (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null,
  owner_id uuid,
  file_name text not null,
  file_path text not null,
  content_type text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table app_files enable row level security;

drop policy if exists "authenticated read" on app_files;
drop policy if exists "staff insert" on app_files;
drop policy if exists "staff update" on app_files;
drop policy if exists "admin delete" on app_files;
create policy "authenticated read" on app_files for select to authenticated using (true);
create policy "staff insert" on app_files for insert to authenticated with check (public.current_role() in ('admin', 'staff'));
create policy "staff update" on app_files for update to authenticated using (public.current_role() in ('admin', 'staff')) with check (public.current_role() in ('admin', 'staff'));
create policy "admin delete" on app_files for delete to authenticated using (public.current_role() = 'admin');

insert into storage.buckets (id, name, public)
values ('mst-attachments', 'mst-attachments', false)
on conflict (id) do nothing;

drop policy if exists "authenticated attachment read" on storage.objects;
drop policy if exists "authenticated attachment insert" on storage.objects;
create policy "authenticated attachment read" on storage.objects
for select to authenticated using (bucket_id = 'mst-attachments');
create policy "authenticated attachment insert" on storage.objects
for insert to authenticated with check (bucket_id = 'mst-attachments');

alter table profiles enable row level security;
drop policy if exists "own profile read" on profiles;
drop policy if exists "own profile insert" on profiles;
drop policy if exists "own profile update" on profiles;
create policy "own profile read" on profiles for select to authenticated using (id = auth.uid() or public.current_role() = 'admin');
create policy "own profile insert" on profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on profiles for update to authenticated using (id = auth.uid() or public.current_role() = 'admin') with check (id = auth.uid() or public.current_role() = 'admin');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_user boolean;
begin
  select not exists (select 1 from profiles) into first_user;
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when first_user then 'admin'::user_role else 'staff'::user_role end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into profiles (id, email, role)
select id, email, case when row_number() over (order by created_at) = 1 then 'admin'::user_role else 'staff'::user_role end
from auth.users
on conflict (id) do nothing;

with first_profile as (
  select id from profiles order by created_at asc limit 1
)
update profiles set role = 'admin'
where id in (select id from first_profile)
  and not exists (select 1 from profiles where role = 'admin');

alter table customers alter column payment_mode drop not null;

alter table invoices add column if not exists attachment_file_id uuid references app_files(id) on delete set null;
alter table payments add column if not exists attachment_file_id uuid references app_files(id) on delete set null;
alter table cheques add column if not exists attachment_file_id uuid references app_files(id) on delete set null;
alter table purchase_orders add column if not exists supplier_invoice_number text;
alter table purchase_orders add column if not exists attachment_file_id uuid references app_files(id) on delete set null;
alter table damage_records add column if not exists customer_id uuid references customers(id) on delete set null;
alter table damage_records add column if not exists subaccount_id uuid references customer_subaccounts(id) on delete set null;
alter table damage_records add column if not exists supplier_id uuid references suppliers(id) on delete set null;
alter table damage_records add column if not exists balance_credit numeric(12,2) not null default 0;

create table if not exists supplier_adjustments (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  item_id uuid references items(id),
  adjustment_type text not null check (adjustment_type in ('return', 'damage', 'credit')),
  quantity numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  reason text,
  adjustment_date date not null default current_date,
  attachment_file_id uuid references app_files(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table supplier_adjustments enable row level security;
drop policy if exists "authenticated read" on supplier_adjustments;
drop policy if exists "staff insert" on supplier_adjustments;
drop policy if exists "staff update" on supplier_adjustments;
drop policy if exists "admin delete" on supplier_adjustments;
create policy "authenticated read" on supplier_adjustments for select to authenticated using (true);
create policy "staff insert" on supplier_adjustments for insert to authenticated with check (public.current_role() in ('admin', 'staff'));
create policy "staff update" on supplier_adjustments for update to authenticated using (public.current_role() in ('admin', 'staff')) with check (public.current_role() in ('admin', 'staff'));
create policy "admin delete" on supplier_adjustments for delete to authenticated using (public.current_role() = 'admin');

create or replace view supplier_balances as
select
  s.id as supplier_id,
  s.name,
  (coalesce(po.total_due, 0) - coalesce(sp.total_paid, 0) - coalesce(sa.total_adjusted, 0))::numeric(12,2) as balance
from suppliers s
left join (
  select supplier_id, sum(total) as total_due
  from purchase_orders
  group by supplier_id
) po on po.supplier_id = s.id
left join (
  select supplier_id, sum(amount) as total_paid
  from supplier_payments
  group by supplier_id
) sp on sp.supplier_id = s.id
left join (
  select supplier_id, sum(amount) as total_adjusted
  from supplier_adjustments
  group by supplier_id
) sa on sa.supplier_id = s.id;
