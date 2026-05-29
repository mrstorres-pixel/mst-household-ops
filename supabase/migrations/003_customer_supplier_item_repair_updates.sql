alter table items add column if not exists primary_supplier_id uuid references suppliers(id) on delete set null;
alter table damage_records add column if not exists missing_parts text;
alter table damage_records add column if not exists repair_charge numeric(12,2) not null default 0;

create index if not exists items_primary_supplier_id_idx on items(primary_supplier_id);
