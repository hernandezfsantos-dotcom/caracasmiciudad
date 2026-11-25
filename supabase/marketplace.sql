alter table public.anuncios add column if not exists condiciones text not null default '',
 add column if not exists instrucciones text not null default '',
 add column if not exists organizador text not null default '',
 add column if not exists motivo text,
 add column if not exists comision_aceptada boolean not null default false;
alter table public.reservas add column if not exists total numeric(14,2),
 add column if not exists moneda text,
 add column if not exists pagada boolean not null default false,
 add column if not exists actualizada timestamptz not null default now();
create index if not exists reservas_anuncio_estado on public.reservas(anuncio_id,estado);
create index if not exists reservas_cliente on public.reservas(cliente_id);
create index if not exists anuncios_fecha on public.anuncios(estado,fecha_inicio);

create table if not exists public.administradores (id uuid primary key references auth.users(id) on delete cascade);
create table if not exists public.acciones_admin (
 id bigint generated always as identity primary key,
 actor uuid not null, accion text not null, objeto text not null, detalle text, fecha timestamptz not null default now()
);
alter table public.administradores enable row level security;
alter table public.acciones_admin enable row level security;
revoke all on public.administradores,public.acciones_admin from anon,authenticated;

create or replace function public.es_admin() returns boolean language sql stable security definer
set search_path='' as $$
 select exists(select 1 from public.administradores where id=auth.uid());
$$;

create or replace function public.proteger_anuncio() returns trigger language plpgsql security definer
set search_path='' as $$
declare p public.perfiles; ocupados int;
begin
 if auth.uid() is null or public.es_admin() then return new; end if;
 if new.anunciante_id<>auth.uid() then raise exception 'Solo puedes gestionar tus propios anuncios.'; end if;
 select * into p from public.perfiles where id=auth.uid();
 if p.tipo is null or p.tipo='cliente' then raise exception 'Completa tu perfil de anunciante.'; end if;
 if tg_op='UPDATE' then
   if new.id<>old.id or new.anunciante_id<>old.anunciante_id then raise exception 'No puedes cambiar el propietario.'; end if;
   select coalesce(sum(cantidad),0) into ocupados from public.reservas where anuncio_id=old.id and estado in ('pendiente','confirmada','completada');
   if new.cupos<ocupados then raise exception 'Los cupos deben cubrir las reservas existentes.'; end if;
   if ocupados>0 and (old.fecha_inicio,old.municipio,old.zona,old.direccion,old.precio,old.moneda) is distinct from
    (new.fecha_inicio,new.municipio,new.zona,new.direccion,new.precio,new.moneda) then
     raise exception 'La fecha, el lugar y el precio quedan fijos cuando hay reservas activas.';
   end if;
   if new.estado='pausado' and (to_jsonb(new)-'estado')=(to_jsonb(old)-'estado') then return new; end if;
 end if;
 if not new.comision_aceptada or new.fecha_inicio is null or new.fecha_inicio<=now() or new.cupos is null or new.cupos not between 1 and 5000
 or length(trim(new.titulo)) not between 1 and 95 or length(trim(new.descripcion)) not between 1 and 3000
 or coalesce(length(trim(new.direccion)),0) not between 1 and 180 or new.precio>100000000 or new.precio<>round(new.precio,2)
 or (new.precio>0 and length(trim(new.instrucciones))=0) or length(new.instrucciones)>1200 or length(new.condiciones)>1200
 or coalesce(new.whatsapp,'') !~ '^\+?[0-9]{8,15}$'
 then raise exception 'Revisa el precio, la fecha, el contacto, los cupos y la comisión.'; end if;
 if not exists(select 1 from public.categorias where nombre=new.categoria and activa) or
 not exists(select 1 from public.zonas where municipio=new.municipio and nombre=new.zona and activa)
 then raise exception 'Selecciona una categoría y una zona activas.'; end if;
 if cardinality(new.imagenes) not between 1 and 5 or exists(
   select 1 from unnest(new.imagenes) f where split_part(f,'/',1)<>auth.uid()::text
   or not exists(select 1 from storage.objects o where o.bucket_id='anuncios' and o.name=f)
 ) then raise exception 'Sube entre una y cinco fotos propias.'; end if;
 new.organizador=coalesce(nullif(trim(p.empresa),''),p.nombre);
 new.estado='pendiente'; new.motivo=null;
 return new;
end;
$$;
drop trigger if exists proteger_anuncio on public.anuncios;
create trigger proteger_anuncio before insert or update on public.anuncios for each row execute function public.proteger_anuncio();

create or replace function public.cupos_disponibles(ids uuid[]) returns table(anuncio uuid,libres bigint)
language sql stable security definer set search_path='' as $$
 select a.id,greatest(0,coalesce(a.cupos,0)-coalesce(sum(r.cantidad),0))
 from public.anuncios a left join public.reservas r on r.anuncio_id=a.id and r.estado in ('pendiente','confirmada','completada')
 where a.id=any(ids) and (a.estado='publicado' or a.anunciante_id=auth.uid() or public.es_admin()) group by a.id;
$$;

drop policy if exists "Crear reservas propias" on public.reservas;
revoke insert,update,delete on public.reservas from anon,authenticated;
create or replace function public.pedir_reserva(actividad uuid, plazas integer) returns uuid
language plpgsql security definer set search_path='' as $$
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
 (r.estado='pendiente' and (accion='rechazada' or (accion='confirmada' and a.estado='publicado' and a.fecha_inicio>now()))) or
 (r.estado='confirmada' and (accion='completada' or (accion='pagada' and not r.pagada))) or
 (r.estado='completada' and accion='pagada' and not r.pagada)) then null;
 else raise exception 'Este cambio no está disponible.'; end if;
 update public.reservas set estado=case when accion='pagada' then r.estado else accion end,
 pagada=r.pagada or accion='pagada',actualizada=now() where id=r.id;
end;
$$;

-- Admin write operations always authorize against the private allowlist and write an audit entry.
create or replace function public.moderar_anuncio(actividad uuid, nuevo text, razon text default '') returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.es_admin() then raise exception 'Acceso restringido.'; end if;
 if nuevo is null or nuevo not in ('publicado','rechazado','pausado') or length(coalesce(razon,''))>500
 or (nuevo='rechazado' and coalesce(length(trim(razon)),0)=0) then raise exception 'Indica un estado y, si rechazas, un motivo.'; end if;
 update public.anuncios set estado=nuevo,motivo=nullif(trim(razon),'') where id=actividad;
 if not found then raise exception 'Anuncio no disponible.'; end if;
 insert into public.acciones_admin(actor,accion,objeto,detalle) values(auth.uid(),nuevo,actividad::text,razon);
end;
$$;

create or replace function public.gestionar_catalogo(clase text,nombre_nuevo text,municipio_nuevo text,habilitada boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.es_admin() then raise exception 'Acceso restringido.'; end if;
 if coalesce(length(trim(nombre_nuevo)),0) not between 1 and 80 or habilitada is null then raise exception 'Revisa los datos.'; end if;
 if clase='categoria' then
 insert into public.categorias(nombre,activa) values(trim(nombre_nuevo),habilitada) on conflict(nombre) do update set activa=excluded.activa;
 elsif clase='zona' and coalesce(length(trim(municipio_nuevo)),0) between 1 and 80 then
 insert into public.zonas(nombre,municipio,activa) values(trim(nombre_nuevo),trim(municipio_nuevo),habilitada) on conflict(municipio,nombre) do update set activa=excluded.activa;
 else raise exception 'Selecciona una categoría o una zona con municipio.'; end if;
 insert into public.acciones_admin(actor,accion,objeto,detalle) values(auth.uid(),clase,nombre_nuevo,habilitada::text);
end;
$$;

create or replace function public.panel_administrativo() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.es_admin() then raise exception 'Acceso restringido.'; end if;
 return jsonb_build_object(
 'usuarios',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('email',u.email)),'[]') from public.perfiles p join auth.users u on u.id=p.id),
 'reservas',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,anuncio_id,cantidad,estado,total,moneda,pagada,creado from public.reservas order by creado desc limit 200) r),
 'acciones',(select coalesce(jsonb_agg(to_jsonb(l)),'[]') from (select * from public.acciones_admin order by fecha desc limit 50) l));
end;
$$;

create or replace function public.crear_perfil_confirmable() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.perfiles(id,nombre) values(new.id,coalesce(nullif(left(trim(new.raw_user_meta_data->>'nombre'),80),''),'Usuario')) on conflict(id) do nothing;
 return new;
end;
$$;
drop trigger if exists caracas_crear_perfil on auth.users;
create trigger caracas_crear_perfil after insert on auth.users for each row execute function public.crear_perfil_confirmable();

drop policy if exists "Administrar lectura anuncios" on public.anuncios;
create policy "Administrar lectura anuncios" on public.anuncios for select to authenticated using ((select public.es_admin()));
drop policy if exists "Administrar fotos anuncios" on storage.objects;
create policy "Administrar fotos anuncios" on storage.objects for select to authenticated using (bucket_id='anuncios' and (select public.es_admin()));
drop policy if exists "Eliminar fotos propias sin uso" on storage.objects;
create policy "Eliminar fotos propias sin uso" on storage.objects for delete to authenticated using (bucket_id='anuncios' and (storage.foldername(name))[1]=(select auth.uid())::text and not exists(select 1 from public.anuncios a where name=any(a.imagenes)));
drop policy if exists "Ver categorías administrativas" on public.categorias;
create policy "Ver categorías administrativas" on public.categorias for select to authenticated using ((select public.es_admin()));
drop policy if exists "Ver zonas administrativas" on public.zonas;
create policy "Ver zonas administrativas" on public.zonas for select to authenticated using ((select public.es_admin()));
update storage.buckets set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id='anuncios';

revoke all on function public.proteger_anuncio(),public.crear_perfil_confirmable(),public.es_admin(),public.cupos_disponibles(uuid[]),public.pedir_reserva(uuid,integer),public.gestionar_reserva(uuid,text),public.moderar_anuncio(uuid,text,text),public.gestionar_catalogo(text,text,text,boolean),public.panel_administrativo() from public,anon,authenticated;
grant execute on function public.cupos_disponibles(uuid[]) to anon,authenticated;
grant execute on function public.es_admin(),public.pedir_reserva(uuid,integer),public.gestionar_reserva(uuid,text),public.moderar_anuncio(uuid,text,text),public.gestionar_catalogo(text,text,text,boolean),public.panel_administrativo() to authenticated;
grant select on public.anuncios,public.categorias,public.zonas to anon,authenticated;
grant select,insert,update on public.perfiles to authenticated;
grant insert,update on public.anuncios to authenticated;
grant select on public.reservas to authenticated;
grant select,insert,delete on public.favoritos to authenticated;
