create or replace function public.autorizar_proprietaria() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.email_confirmed_at is not null and new.email is not null and
  encode(sha256(convert_to(lower(new.email),'UTF8')),'hex')='5be94e7add9a7f068ed858b59bd748de15f5d51ff17662f707d18630be1a4505'
 then insert into public.administradores(id) values(new.id) on conflict do nothing; end if;
 return new;
end;
$$;
revoke all on function public.autorizar_proprietaria() from public,anon,authenticated;
drop trigger if exists caracas_autorizar_proprietaria on auth.users;
create trigger caracas_autorizar_proprietaria after insert or update of email_confirmed_at on auth.users
for each row execute function public.autorizar_proprietaria();
insert into public.administradores(id)
select id from auth.users where email_confirmed_at is not null and
 encode(sha256(convert_to(lower(email),'UTF8')),'hex')='5be94e7add9a7f068ed858b59bd748de15f5d51ff17662f707d18630be1a4505'
on conflict do nothing;

create or replace function public.minhas_reservas() returns setof jsonb
language sql stable security definer set search_path='' as $$
 select to_jsonb(r)||jsonb_build_object(
  'contacto',case when a.anunciante_id=auth.uid() then u.email else null end,
  'anuncio',jsonb_build_object('id',a.id,'titulo',a.titulo,'fecha_inicio',a.fecha_inicio,'whatsapp',a.whatsapp,'instrucciones',a.instrucciones)
 )
 from public.reservas r join public.anuncios a on a.id=r.anuncio_id
 join auth.users u on u.id=r.cliente_id
 where auth.uid() is not null and (r.cliente_id=auth.uid() or a.anunciante_id=auth.uid())
 order by r.actualizada desc
$$;
revoke all on function public.minhas_reservas() from public,anon,authenticated;
grant execute on function public.minhas_reservas() to authenticated;
