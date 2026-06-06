create or replace view supplier_invoice_summaries as
select
  (array_agg(po.id order by po.order_date desc, po.created_at desc, po.id))[1] as id,
  po.supplier_id,
  po.supplier_invoice_number,
  max(po.order_date) as order_date,
  sum(po.total)::numeric(12,2) as total,
  count(*)::integer as line_count,
  array_remove(array_agg(distinct i.name), null) as item_names,
  case when count(*) = 1 then min(i.name) else count(*)::text || ' items' end as item_name,
  s.name as supplier_name
from purchase_orders po
join suppliers s on s.id = po.supplier_id
left join items i on i.id = po.item_id
group by
  po.supplier_id,
  po.supplier_invoice_number,
  case when nullif(trim(coalesce(po.supplier_invoice_number, '')), '') is null then po.id else null end,
  s.name;
