-- Reglas de cambio de estado:
--  * vendedor/admin: aprobar, enviar a preparar, cancelar
--  * despachar: SOLO bodega (y admin); el vendedor ya no puede
--  * bodega: solo despachar (ya no inicia la preparación: eso lo envia el vendedor)
create or replace function public.set_order_status(
  p_order_id   uuid,
  p_new_status public.order_status,
  p_reason     text default null
) returns public.order_status
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_old     public.order_status;
  v_wh      uuid;
  v_valid   boolean;
  v_item    record;
begin
  select o.status, o.warehouse_id into v_old, v_wh
  from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  v_valid := case v_old
    when 'recibido'    then p_new_status in ('en_revision', 'preparando', 'cancelado')
    when 'en_revision' then p_new_status in ('aprobado', 'cancelado')
    when 'aprobado'    then p_new_status in ('preparando', 'cancelado')
    when 'preparando'  then p_new_status in ('despachado', 'cancelado')
    else false
  end;
  if not v_valid then
    raise exception 'invalid_transition: % -> %', v_old, p_new_status using errcode = '22023';
  end if;

  if v_uid is not null and not (
    case when p_new_status = 'despachado'
      then public.has_permission('PREPARE_ORDERS')
      else public.has_permission('UPDATE_ORDER_STATUS')
    end
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_new_status = 'cancelado' then
    for v_item in
      select oi.product_id, oi.quantity_confirmed as qty
      from public.order_items oi
      where oi.order_id = p_order_id and oi.quantity_confirmed > 0
      order by oi.product_id
    loop
      insert into public.stock (product_id, warehouse_id, quantity)
      values (v_item.product_id, v_wh, v_item.qty)
      on conflict (product_id, warehouse_id)
      do update set quantity = public.stock.quantity + excluded.quantity, updated_at = now();

      insert into public.stock_movements (product_id, warehouse_id, delta, reason, order_id, user_id)
      values (v_item.product_id, v_wh, v_item.qty, 'cancel_restock', p_order_id, v_uid);
    end loop;
  end if;

  update public.orders set status = p_new_status, updated_at = now() where id = p_order_id;

  insert into public.order_events (order_id, from_status, to_status, user_id, reason)
  values (p_order_id, v_old, p_new_status, v_uid, p_reason);

  return p_new_status;
end;
$$;
