begin;

create table if not exists public.yici_states (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb
    check (jsonb_typeof(state) = 'object' and octet_length(state::text) <= 2000000),
  schema_version integer not null default 4 check (schema_version between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_yici_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists yici_states_set_updated_at on public.yici_states;
create trigger yici_states_set_updated_at
  before update on public.yici_states
  for each row execute procedure public.set_yici_updated_at();

alter table public.yici_states enable row level security;

drop policy if exists "yici_owner_select" on public.yici_states;
create policy "yici_owner_select" on public.yici_states for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "yici_owner_insert" on public.yici_states;
create policy "yici_owner_insert" on public.yici_states for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "yici_owner_update" on public.yici_states;
create policy "yici_owner_update" on public.yici_states for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "yici_owner_delete" on public.yici_states;
create policy "yici_owner_delete" on public.yici_states for delete to authenticated
  using (owner_id = auth.uid());

revoke all on public.yici_states from anon, authenticated;
grant select, insert, update, delete on public.yici_states to authenticated;

commit;
