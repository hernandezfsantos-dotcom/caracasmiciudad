create table public.notificaciones (
 id bigint generated always as identity primary key,
 usuario_id uuid not null references auth.users(id) on delete cascade,
 mensaje text not null,
 creada timestamptz not null default now(),
 leida boolean not null default false
);
create index notificaciones_usuario_recientes on public.notificaciones(usuario_id,id desc);
alter table public.notificaciones enable row level security;
revoke all on public.notificaciones from public, anon, authenticated;
grant select,update(leida) on public.notificaciones to authenticated;
create policy leer_notificaciones on public.notificaciones for select to authenticated using(usuario_id=(select auth.uid()));
create policy marcar_notificaciones on public.notificaciones for update to authenticated using(usuario_id=(select auth.uid())) with check(usuario_id=(select auth.uid()));
create function public.avisar_estado_marketplace() returns trigger language plpgsql security definer set search_path='' as $$
declare actividad public.anuncios; mensaje text;
begin
 if tg_op='UPDATE' and new.estado is not distinct from old.estado then return new; end if;
 if tg_table_name='reservas' then
   select * into strict actividad from public.anuncios where id=new.anuncio_id;
   mensaje:=format('Reserva %s · %s · %s participante(s)',new.estado,actividad.titulo,new.cantidad);
   insert into public.notificaciones(usuario_id,mensaje) values(new.cliente_id,mensaje),(actividad.anunciante_id,mensaje);
 else
   insert into public.notificaciones(usuario_id,mensaje) values(new.anunciante_id,format('Actividad %s · %s',new.estado,new.titulo));
 end if;
 return new;
end;
$$;
revoke all on function public.avisar_estado_marketplace() from public,anon,authenticated;
create trigger aviso_reserva after insert or update of estado on public.reservas for each row execute function public.avisar_estado_marketplace();
create trigger aviso_anuncio after insert or update of estado on public.anuncios for each row execute function public.avisar_estado_marketplace();
