create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  rating smallint not null check (rating between 1 and 5),
  text text not null check (char_length(btrim(text)) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists reviews_created_at_idx
  on public.reviews (created_at desc);

alter table public.reviews enable row level security;

drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read
  on public.reviews
  for select
  to anon, authenticated
  using (true);

drop policy if exists reviews_public_insert on public.reviews;
create policy reviews_public_insert
  on public.reviews
  for insert
  to anon, authenticated
  with check (
    rating between 1 and 5
    and char_length(btrim(text)) between 1 and 280
  );

grant usage on schema public to anon, authenticated;
grant select, insert on table public.reviews to anon, authenticated;

notify pgrst, 'reload schema';
