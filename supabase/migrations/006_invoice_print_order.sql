alter table invoice_items add column if not exists sort_order integer not null default 0;
alter table returns add column if not exists sort_order integer not null default 0;
alter table damage_records add column if not exists invoice_id uuid references invoices(id) on delete set null;
alter table damage_records add column if not exists sort_order integer not null default 0;

with ranked_invoice_items as (
  select
    id,
    row_number() over (partition by invoice_id order by id)::integer - 1 as row_order
  from invoice_items
)
update invoice_items
set sort_order = ranked_invoice_items.row_order
from ranked_invoice_items
where invoice_items.id = ranked_invoice_items.id;

with ranked_returns as (
  select
    id,
    row_number() over (partition by invoice_id order by created_at, id)::integer - 1 as row_order
  from returns
  where invoice_id is not null
)
update returns
set sort_order = ranked_returns.row_order
from ranked_returns
where returns.id = ranked_returns.id;

update damage_records
set invoice_id = invoices.id
from invoices
where damage_records.invoice_id is null
  and damage_records.customer_id = invoices.customer_id
  and damage_records.reason ilike invoices.invoice_number || ':%';

with ranked_damages as (
  select
    id,
    row_number() over (partition by invoice_id order by created_at, id)::integer - 1 as row_order
  from damage_records
  where invoice_id is not null
)
update damage_records
set sort_order = ranked_damages.row_order
from ranked_damages
where damage_records.id = ranked_damages.id;

create index if not exists invoice_items_invoice_sort_idx on invoice_items(invoice_id, sort_order);
create index if not exists returns_invoice_sort_idx on returns(invoice_id, sort_order);
create index if not exists damage_records_invoice_sort_idx on damage_records(invoice_id, sort_order);
