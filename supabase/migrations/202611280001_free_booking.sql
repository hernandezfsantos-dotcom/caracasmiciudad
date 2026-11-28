-- Aplicar después de marketplace.sql y marketplace_access.sql, con respaldo verificado.
-- Conserva las reservas existentes y los permisos de las dos funciones.
BEGIN;
create or replace function public.pedir_reserva(actividad uuid, plazas integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.anuncios; r uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.perfiles where id=auth.uid()) then raise exception 'Completa tu perfil para reservar.'; end if;
 if plazas is null or plazas not between 1 and 100 then raise exception 'Indica entre 1 y 100 participantes.'; end if;
 select * into a from public.anuncios where id=actividad for update;
 if a.id is null or a.estado<>'publicado' or a.anunciante_id=auth.uid() or a.fecha_inicio is null or a.fecha_inicio<=now() then raise exception 'Esta actividad no se puede reservar.'; end if;
 if a.precio is distinct from 0 then raise exception 'El pago en línea todavía no está disponible.'; end if;
 select id into r from public.reservas where anuncio_id=actividad and cliente_id=auth.uid() and estado in ('pendiente','confirmada');
 if r is not null then return r; end if;
 if coalesce(a.cupos,0) < plazas + (select coalesce(sum(cantidad),0) from public.reservas where anuncio_id=actividad and estado in ('pendiente','confirmada','completada')) then raise exception 'Ya no hay suficientes plazas.'; end if;
 insert into public.reservas(cliente_id,anuncio_id,cantidad,total,moneda,estado) values(auth.uid(),actividad,plazas,0,a.moneda,'confirmada') returning id into r;
 return r;
end;
$$;

create or replace function public.gestionar_reserva(reserva uuid, accion text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.reservas; a public.anuncios;
begin
 if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
 select * into r from public.reservas where id=reserva for update;
 select * into a from public.anuncios where id=r.anuncio_id;
 if r.id is null then raise exception 'Reserva no disponible.'; end if;
 if accion='cancelada' and r.cliente_id=auth.uid() and r.estado in ('pendiente','confirmada') and not r.pagada then null;
 elsif a.anunciante_id=auth.uid() and (
 (r.estado='pendiente' and (accion='rechazada' or (accion='confirmada' and r.total=0 and a.estado='publicado' and a.fecha_inicio>now()))) or
 (r.estado='confirmada' and accion='completada' and (r.total=0 or r.pagada))) then null;
 else raise exception 'Este cambio no está disponible.'; end if;
 update public.reservas set estado=accion,actualizada=now() where id=r.id;
end;
$$;

COMMIT;
