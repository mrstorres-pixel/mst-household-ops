alter table returns add column if not exists unit_price numeric(12,2) not null default 0;
alter table returns add column if not exists charge numeric(12,2) not null default 0;

alter table damage_records add column if not exists unit_price numeric(12,2) not null default 0;
alter table damage_records add column if not exists return_charge numeric(12,2) not null default 0;

update returns
set unit_price = coalesce(items.default_price, 0),
    charge = greatest(0, coalesce(returns.amount, 0) - coalesce(returns.quantity, 0) * coalesce(items.default_price, 0))
from items
where returns.item_id = items.id
  and returns.unit_price = 0
  and returns.quantity > 0;

update damage_records
set unit_price = coalesce(items.default_price, 0),
    return_charge = greatest(0, coalesce(damage_records.balance_credit, damage_records.estimated_cost, 0) - coalesce(damage_records.quantity, 0) * coalesce(items.default_price, 0))
from items
where damage_records.item_id = items.id
  and damage_records.unit_price = 0
  and damage_records.quantity > 0;
