create or replace function public.post_inventory_movements_checked(movements jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  create temporary table if not exists pg_temp.inventory_movement_batch (
    item_id uuid not null,
    movement_type movement_type not null,
    quantity_delta numeric(12,2) not null,
    unit_cost numeric(12,2) not null default 0,
    reference_type text,
    reference_id uuid,
    notes text,
    movement_date date not null default current_date
  ) on commit drop;

  truncate table pg_temp.inventory_movement_batch;

  insert into pg_temp.inventory_movement_batch (
    item_id,
    movement_type,
    quantity_delta,
    unit_cost,
    reference_type,
    reference_id,
    notes,
    movement_date
  )
  select
    (row->>'item_id')::uuid,
    (row->>'movement_type')::movement_type,
    coalesce(nullif(row->>'quantity_delta', '')::numeric, 0),
    coalesce(nullif(row->>'unit_cost', '')::numeric, 0),
    nullif(row->>'reference_type', ''),
    nullif(row->>'reference_id', '')::uuid,
    nullif(row->>'notes', ''),
    coalesce(nullif(row->>'movement_date', '')::date, current_date)
  from jsonb_array_elements(movements) as row;

  perform 1
  from items
  where id in (select distinct item_id from pg_temp.inventory_movement_batch)
  for update;

  if exists (
    select 1
    from items i
    join (
      select item_id, sum(quantity_delta) as quantity_delta
      from pg_temp.inventory_movement_batch
      group by item_id
    ) batch on batch.item_id = i.id
    where i.current_quantity + batch.quantity_delta < 0
  ) then
    raise exception 'Insufficient stock for one or more items.';
  end if;

  insert into inventory_movements (
    item_id,
    movement_type,
    quantity_delta,
    unit_cost,
    reference_type,
    reference_id,
    notes,
    movement_date
  )
  select
    item_id,
    movement_type,
    quantity_delta,
    unit_cost,
    reference_type,
    reference_id,
    notes,
    movement_date
  from pg_temp.inventory_movement_batch;
end;
$$;

grant execute on function public.post_inventory_movements_checked(jsonb) to authenticated;
