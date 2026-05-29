alter table customers add column if not exists is_active boolean not null default true;
alter table suppliers add column if not exists is_active boolean not null default true;

create or replace view customer_balances as
select
  c.id as customer_id,
  c.name,
  coalesce(sum(le.debit - le.credit), 0)::numeric(12,2) as balance
from customers c
left join customer_ledger_entries le on le.customer_id = c.id
where c.is_active = true
group by c.id, c.name;

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
) sa on sa.supplier_id = s.id
where s.is_active = true
group by s.id, s.name, po.total_due, sp.total_paid, sa.total_adjusted;
