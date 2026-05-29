create extension if not exists "pgcrypto";

do $$
begin
  create type user_role as enum ('admin', 'staff');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type cheque_status as enum ('received', 'redeemed', 'bounced', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type payment_method as enum ('cash', 'bank', 'cheque');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type movement_type as enum ('purchase', 'sale', 'return', 'replacement_out', 'replacement_in', 'damage', 'adjustment');
exception when duplicate_object then null;
end $$;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role user_role not null default 'staff',
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  id boolean primary key default true,
  business_name text not null default 'MST Household',
  currency text not null default 'PHP',
  timezone text not null default 'Asia/Singapore',
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id)
);

insert into app_settings (id) values (true) on conflict (id) do nothing;

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete set null,
  sku text unique,
  name text not null,
  default_price numeric(12,2) not null default 0,
  unit_cost numeric(12,2) not null default 0,
  current_quantity numeric(12,2) not null default 0,
  reorder_level numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists items_search_idx on items using gin (to_tsvector('simple', coalesce(sku, '') || ' ' || name));

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  account_code text unique,
  name text not null,
  phone text,
  address text,
  payment_mode text not null default 'cash',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists customers_search_idx on customers using gin (to_tsvector('simple', coalesce(account_code, '') || ' ' || name));

create table if not exists customer_subaccounts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (customer_id, name)
);

create table if not exists customer_item_templates (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  item_id uuid not null references items(id),
  quantity numeric(12,2) not null default 1,
  price numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (customer_id, item_id)
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_id uuid not null references customers(id),
  subaccount_id uuid references customer_subaccounts(id),
  status text not null default 'posted',
  invoice_date date not null default current_date,
  subtotal numeric(12,2) not null default 0,
  charges_total numeric(12,2) not null default 0,
  returns_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  item_id uuid not null references items(id),
  description text not null,
  quantity numeric(12,2) not null,
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null
);

create table if not exists customer_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  subaccount_id uuid references customer_subaccounts(id) on delete set null,
  invoice_id uuid references invoices(id) on delete set null,
  payment_id uuid,
  entry_type text not null,
  description text not null,
  debit numeric(12,2) not null default 0,
  credit numeric(12,2) not null default 0,
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  subaccount_id uuid references customer_subaccounts(id),
  method payment_method not null,
  amount numeric(12,2) not null,
  payment_date date not null default current_date,
  reference text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table customer_ledger_entries
  drop constraint if exists customer_ledger_entries_payment_id_fkey;

alter table customer_ledger_entries
  add constraint customer_ledger_entries_payment_id_fkey
  foreign key (payment_id) references payments(id) on delete set null;

create table if not exists cheques (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references payments(id) on delete set null,
  customer_id uuid not null references customers(id),
  cheque_number text,
  bank_name text,
  amount numeric(12,2) not null,
  received_date date not null default current_date,
  redeemed_date date,
  status cheque_status not null default 'received',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists returns (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete set null,
  customer_id uuid not null references customers(id),
  item_id uuid references items(id),
  quantity numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  reason text,
  return_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists charges (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  subaccount_id uuid references customer_subaccounts(id),
  invoice_id uuid references invoices(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null,
  charge_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists replacements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  invoice_id uuid references invoices(id) on delete set null,
  old_item_id uuid references items(id),
  new_item_id uuid references items(id),
  quantity numeric(12,2) not null default 1,
  amount_difference numeric(12,2) not null default 0,
  replacement_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id),
  movement_type movement_type not null,
  quantity_delta numeric(12,2) not null,
  unit_cost numeric(12,2) not null default 0,
  reference_type text,
  reference_id uuid,
  notes text,
  movement_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists damage_records (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id),
  quantity numeric(12,2) not null,
  estimated_cost numeric(12,2) not null default 0,
  reason text,
  damage_date date not null default current_date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_name text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists supplier_items (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  supplier_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (supplier_id, item_id)
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  item_id uuid not null references items(id),
  quantity numeric(12,2) not null,
  unit_cost numeric(12,2) not null,
  total numeric(12,2) not null,
  status text not null default 'received',
  order_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists supplier_payments (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  amount numeric(12,2) not null,
  payment_date date not null default current_date,
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  category text not null default 'general',
  amount numeric(12,2) not null,
  expense_date date not null default current_date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists cash_sales (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete set null,
  amount numeric(12,2) not null,
  sale_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists daily_summaries (
  id uuid primary key default gen_random_uuid(),
  summary_date date not null unique,
  cash_sales_total numeric(12,2) not null default 0,
  expenses_total numeric(12,2) not null default 0,
  cash_flow numeric(12,2) not null default 0,
  stock_value numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists cutoff_summaries (
  id uuid primary key default gen_random_uuid(),
  cutoff_date date not null unique,
  customer_balance_total numeric(12,2) not null default 0,
  supplier_balance_total numeric(12,2) not null default 0,
  stock_value numeric(12,2) not null default 0,
  net_position numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create or replace view customer_balances as
select
  c.id as customer_id,
  c.name,
  coalesce(sum(le.debit - le.credit), 0)::numeric(12,2) as balance
from customers c
left join customer_ledger_entries le on le.customer_id = c.id
group by c.id, c.name;

create or replace view customer_subaccount_balances as
select
  s.id as subaccount_id,
  s.customer_id,
  s.name,
  coalesce(sum(le.debit - le.credit), 0)::numeric(12,2) as balance
from customer_subaccounts s
left join customer_ledger_entries le on le.subaccount_id = s.id
group by s.id, s.customer_id, s.name;

create or replace view supplier_balances as
select
  s.id as supplier_id,
  s.name,
  (coalesce(po.total_due, 0) - coalesce(sp.total_paid, 0))::numeric(12,2) as balance
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
) sp on sp.supplier_id = s.id;

create or replace view inventory_stock_value as
select coalesce(sum(current_quantity * unit_cost), 0)::numeric(12,2) as stock_value
from items
where is_active = true;

create or replace function touch_item_quantity()
returns trigger
language plpgsql
as $$
begin
  update items
  set current_quantity = current_quantity + new.quantity_delta
  where id = new.item_id;
  return new;
end;
$$;

drop trigger if exists inventory_movements_touch_item_quantity on inventory_movements;
create trigger inventory_movements_touch_item_quantity
after insert on inventory_movements
for each row execute function touch_item_quantity();

alter table profiles enable row level security;
alter table app_settings enable row level security;
alter table categories enable row level security;
alter table items enable row level security;
alter table customers enable row level security;
alter table customer_subaccounts enable row level security;
alter table customer_item_templates enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table customer_ledger_entries enable row level security;
alter table payments enable row level security;
alter table cheques enable row level security;
alter table returns enable row level security;
alter table charges enable row level security;
alter table replacements enable row level security;
alter table inventory_movements enable row level security;
alter table damage_records enable row level security;
alter table suppliers enable row level security;
alter table supplier_items enable row level security;
alter table purchase_orders enable row level security;
alter table supplier_payments enable row level security;
alter table expenses enable row level security;
alter table cash_sales enable row level security;
alter table daily_summaries enable row level security;
alter table cutoff_summaries enable row level security;

create or replace function public.current_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles','app_settings','categories','items','customers','customer_subaccounts',
    'customer_item_templates','invoices','invoice_items','customer_ledger_entries',
    'payments','cheques','returns','charges','replacements','inventory_movements',
    'damage_records','suppliers','supplier_items','purchase_orders','supplier_payments',
    'expenses','cash_sales','daily_summaries','cutoff_summaries'
  ]
  loop
    execute format('drop policy if exists "authenticated read" on %I', table_name);
    execute format('drop policy if exists "staff insert" on %I', table_name);
    execute format('drop policy if exists "staff update" on %I', table_name);
    execute format('drop policy if exists "admin delete" on %I', table_name);
    execute format('create policy "authenticated read" on %I for select to authenticated using (true)', table_name);
    execute format('create policy "staff insert" on %I for insert to authenticated with check (public.current_role() in (''admin'', ''staff''))', table_name);
    execute format('create policy "staff update" on %I for update to authenticated using (public.current_role() in (''admin'', ''staff'')) with check (public.current_role() in (''admin'', ''staff''))', table_name);
    execute format('create policy "admin delete" on %I for delete to authenticated using (public.current_role() = ''admin'')', table_name);
  end loop;
end $$;
