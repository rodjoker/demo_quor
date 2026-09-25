-- Nombre de quien hizo cada cambio, guardado junto al registro.
-- El navegador no puede leer los perfiles de otros usuarios (RLS), así que el historial de
-- pedidos y los movimientos de stock guardan el nombre en el momento del cambio.
-- Se rellena con un disparador: no hay que tocar place_order / set_order_status / adjust_stock.

alter table public.stock_movements add column user_name text;
alter table public.order_events    add column user_name text;

create or replace function public.fill_user_name()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.user_id is not null and new.user_name is null then
    select coalesce(nullif(p.full_name, ''), p.email)
      into new.user_name
      from public.profiles p
     where p.id = new.user_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.fill_user_name() from public, anon, authenticated;

create trigger stock_movements_fill_user_name
  before insert on public.stock_movements
  for each row execute procedure public.fill_user_name();

create trigger order_events_fill_user_name
  before insert on public.order_events
  for each row execute procedure public.fill_user_name();
