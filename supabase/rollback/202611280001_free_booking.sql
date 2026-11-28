BEGIN;
CREATE OR REPLACE FUNCTION public.pedir_reserva(actividad uuid, plazas integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.anuncios; r uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.perfiles where id=auth.uid()) then raise exception 'Completa tu perfil para reservar.'; end if;
 if plazas is null or plazas not between 1 and 100 then raise exception 'Indica entre 1 y 100 participantes.'; end if;
 select * into a from public.anuncios where id=actividad for update;
 if a.id is null or a.estado<>'publicado' or a.anunciante_id=auth.uid() or a.fecha_inicio is null or a.fecha_inicio<=now() then raise exception 'Esta actividad no se puede reservar.'; end if;
 select id into r from public.reservas where anuncio_id=actividad and cliente_id=auth.uid() and estado in ('pendiente','confirmada');
 if r is not null then return r; end if;
 if coalesce(a.cupos,0) < plazas + (select coalesce(sum(cantidad),0) from public.reservas where anuncio_id=actividad and estado in ('pendiente','confirmada','completada')) then raise exception 'Ya no hay suficientes plazas.'; end if;
 insert into public.reservas(cliente_id,anuncio_id,cantidad,total,moneda) values(auth.uid(),actividad,plazas,a.precio*plazas,a.moneda) returning id into r;
 return r;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.gestionar_reserva(reserva uuid, accion text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.reservas; a public.anuncios;
begin
 if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
 select * into r from public.reservas where id=reserva for update;
 select * into a from public.anuncios where id=r.anuncio_id;
 if r.id is null then raise exception 'Reserva no disponible.'; end if;
 if accion='cancelada' and r.cliente_id=auth.uid() and r.estado in ('pendiente','confirmada') and not r.pagada then null;
 elsif a.anunciante_id=auth.uid() and (
 (r.estado='pendiente' and (accion='rechazada' or (accion='confirmada' and a.estado='publicado' and a.fecha_inicio>now()))) or
 (r.estado='confirmada' and (accion='completada' or (accion='pagada' and not r.pagada))) or
 (r.estado='completada' and accion='pagada' and not r.pagada)) then null;
 else raise exception 'Este cambio no está disponible.'; end if;
 update public.reservas set estado=case when accion='pagada' then r.estado else accion end,
 pagada=r.pagada or accion='pagada',actualizada=now() where id=r.id;
end;
$function$
;
COMMIT;
