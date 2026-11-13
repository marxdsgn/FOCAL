-- Run once in the Supabase SQL editor or via Supabase migrations.
-- App data is accessible only through the authenticated FOCAL backend.
create table if not exists public.focal_objects (
 key text primary key,
 body text,
 binary_path text,
 etag uuid not null,
 http_metadata jsonb not null default '{}'::jsonb,
 custom_metadata jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.focal_objects enable row level security;
revoke all on public.focal_objects from public, anon, authenticated;
grant all on public.focal_objects to service_role;
create or replace function public.focal_put_object(
 p_key text,p_body text,p_binary_path text,p_etag uuid,
 p_http_metadata jsonb,p_custom_metadata jsonb,p_match uuid default null,p_absent boolean default false
) returns uuid language plpgsql security invoker set search_path = public as $$
declare saved uuid;
begin
 if p_match is not null then
  update public.focal_objects set body=p_body,binary_path=p_binary_path,etag=p_etag,http_metadata=p_http_metadata,custom_metadata=p_custom_metadata,updated_at=now()
  where key=p_key and etag=p_match returning etag into saved;
 elsif p_absent then
  insert into public.focal_objects(key,body,binary_path,etag,http_metadata,custom_metadata)
  values(p_key,p_body,p_binary_path,p_etag,p_http_metadata,p_custom_metadata)
  on conflict(key) do nothing returning etag into saved;
 else
  insert into public.focal_objects(key,body,binary_path,etag,http_metadata,custom_metadata)
  values(p_key,p_body,p_binary_path,p_etag,p_http_metadata,p_custom_metadata)
  on conflict(key) do update set body=excluded.body,binary_path=excluded.binary_path,etag=excluded.etag,http_metadata=excluded.http_metadata,custom_metadata=excluded.custom_metadata,updated_at=now()
  returning etag into saved;
 end if;
 return saved;
end $$;
revoke all on function public.focal_put_object(text,text,text,uuid,jsonb,jsonb,uuid,boolean) from public,anon,authenticated;
grant execute on function public.focal_put_object(text,text,text,uuid,jsonb,jsonb,uuid,boolean) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('focal-photos','focal-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
-- No public object policies: the service-role backend authorizes photo access.
