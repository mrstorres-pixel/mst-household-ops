create or replace function public.touch_item_quantity()
returns trigger
language plpgsql
security definer
set search_path = public
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
for each row execute function public.touch_item_quantity();

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
    (movement.value->>'item_id')::uuid,
    (movement.value->>'movement_type')::movement_type,
    coalesce(nullif(movement.value->>'quantity_delta', '')::numeric, 0),
    coalesce(nullif(movement.value->>'unit_cost', '')::numeric, 0),
    nullif(movement.value->>'reference_type', ''),
    nullif(movement.value->>'reference_id', '')::uuid,
    nullif(movement.value->>'notes', ''),
    coalesce(nullif(movement.value->>'movement_date', '')::date, current_date)
  from jsonb_array_elements(movements) as movement(value);

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
