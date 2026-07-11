begin;

do $$ begin
  create type public.app_role as enum ('member', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.comment_status as enum ('visible', 'hidden');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'member',
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  page_key text not null check (char_length(page_key) between 1 and 500),
  parent_id uuid references public.comments(id) on delete cascade,
  author_id uuid not null constraint comments_author_id_fkey references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  status public.comment_status not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_page_created_idx on public.comments(page_key, created_at);
create index if not exists comments_parent_idx on public.comments(parent_id);

create table if not exists public.study_days (
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null,
  english boolean not null default false,
  japanese boolean not null default false,
  output boolean not null default false,
  note text not null default '' check (char_length(note) <= 5000),
  updated_at timestamptz not null default now(),
  primary key (owner_id, plan_date)
);

create table if not exists public.weekly_reviews (
  owner_id uuid not null references auth.users(id) on delete cascade,
  week_key text not null check (char_length(week_key) between 1 and 80),
  wins text not null default '' check (char_length(wins) <= 5000),
  blocks text not null default '' check (char_length(blocks) <= 5000),
  next_steps text not null default '' check (char_length(next_steps) <= 5000),
  updated_at timestamptz not null default now(),
  primary key (owner_id, week_key)
);

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = check_user_id and role = 'admin'
  );
$$;

create or replace function public.valid_comment_parent(check_parent uuid, check_page text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select check_parent is null or exists (
    select 1 from public.comments
    where id = check_parent and page_key = check_page and status = 'visible'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'user_name', new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'user'), '@', 1), 'user'), 40),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, 'member')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, display_name, avatar_url)
select id,
  left(coalesce(raw_user_meta_data ->> 'user_name', raw_user_meta_data ->> 'full_name', split_part(coalesce(email, 'user'), '@', 1), 'user'), 40),
  raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select id, 'member'::public.app_role from auth.users
on conflict (user_id) do nothing;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.comments enable row level security;
alter table public.study_days enable row level security;
alter table public.weekly_reviews enable row level security;

drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles for select using (true);
drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "roles_owner_or_admin_read" on public.user_roles;
create policy "roles_owner_or_admin_read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "comments_public_read" on public.comments;
create policy "comments_public_read" on public.comments for select
  using (status = 'visible' or author_id = auth.uid() or public.is_admin());
drop policy if exists "comments_verified_insert" on public.comments;
create policy "comments_verified_insert" on public.comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and status = 'visible'
    and public.valid_comment_parent(parent_id, page_key)
  );
drop policy if exists "comments_owner_or_admin_update" on public.comments;
create policy "comments_owner_or_admin_update" on public.comments for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());
drop policy if exists "comments_owner_or_admin_delete" on public.comments;
create policy "comments_owner_or_admin_delete" on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

drop policy if exists "study_admin_all" on public.study_days;
create policy "study_admin_all" on public.study_days for all to authenticated
  using (owner_id = auth.uid() and public.is_admin())
  with check (owner_id = auth.uid() and public.is_admin());
drop policy if exists "reviews_admin_all" on public.weekly_reviews;
create policy "reviews_admin_all" on public.weekly_reviews for all to authenticated
  using (owner_id = auth.uid() and public.is_admin())
  with check (owner_id = auth.uid() and public.is_admin());

revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;
grant select on public.profiles to anon, authenticated;
grant update (display_name, avatar_url, updated_at) on public.profiles to authenticated;
grant select on public.comments to anon, authenticated;
grant insert (page_key, parent_id, author_id, body, status) on public.comments to authenticated;
grant update (body, status, updated_at) on public.comments to authenticated;
grant delete on public.comments to authenticated;
grant select, insert, update, delete on public.study_days to authenticated;
grant select, insert, update, delete on public.weekly_reviews to authenticated;
grant execute on function public.is_admin(uuid) to anon, authenticated;
grant execute on function public.valid_comment_parent(uuid, text) to authenticated;

commit;
