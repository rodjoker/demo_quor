-- Roles
create type public.app_role as enum ('admin', 'operator', 'users');

-- Permissions
create type public.app_permission as enum (
  'CREATE_PROJECT',
  'EDIT_PROJECT',
  'DELETE_PROJECT',
  'UPDATE_PROJECT_STATUS',
  'VIEW_ALL_PROJECTS',
  'VIEW_ASSIGNED_PROJECTS',
  'ASSIGN_WORKERS_TO_PROJECTS',
  'CREATE_USER',
  'EDIT_USER',
  'DELETE_USER',
  'VIEW_ALL_USERS',
  'CREATE_CLIENT',
  'EDIT_CLIENT',
  'DELETE_CLIENT',
  'VIEW_ALL_CLIENTS',
  'VIEW_REPORTS_DASHBOARD',
  'VIEW_FINANCIAL_DATA',
  'SUBMIT_TIMESHEET',
  'APPROVE_TIMESHEET',
  'MANAGE_SYSTEM_SETTINGS'
);

-- Profiles
create table public.profiles (
  id            uuid references auth.users on delete cascade not null primary key,
  updated_at    timestamp with time zone,
  username      text,
  full_name     text,
  address       text,
  phone_number  text,
  email         text unique not null,
  role          public.app_role,
  blocked       boolean not null default false,
  failed_attempts integer not null default 0
);

-- Role → Permission mapping
create table public.role_permissions (
  id         bigserial primary key,
  role       public.app_role not null,
  permission public.app_permission not null,
  unique (role, permission)
);

-- RLS
alter table public.profiles enable row level security;
alter table public.role_permissions enable row level security;

-- (select auth.uid()) cached once per query — 5-10x faster than auth.uid() per row
create policy "Users can view their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- UPDATE needs both USING and WITH CHECK — without WITH CHECK, user_id could be reassigned silently
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Authenticated users can view role permissions"
  on public.role_permissions for select
  to authenticated
  using (true);

-- Grant Data API access to authenticated users
grant select, update on public.profiles to authenticated;
grant select on public.role_permissions to authenticated;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Default permissions per role
insert into public.role_permissions (role, permission) values
  ('admin', 'CREATE_PROJECT'),
  ('admin', 'EDIT_PROJECT'),
  ('admin', 'DELETE_PROJECT'),
  ('admin', 'UPDATE_PROJECT_STATUS'),
  ('admin', 'VIEW_ALL_PROJECTS'),
  ('admin', 'VIEW_ASSIGNED_PROJECTS'),
  ('admin', 'ASSIGN_WORKERS_TO_PROJECTS'),
  ('admin', 'CREATE_USER'),
  ('admin', 'EDIT_USER'),
  ('admin', 'DELETE_USER'),
  ('admin', 'VIEW_ALL_USERS'),
  ('admin', 'CREATE_CLIENT'),
  ('admin', 'EDIT_CLIENT'),
  ('admin', 'DELETE_CLIENT'),
  ('admin', 'VIEW_ALL_CLIENTS'),
  ('admin', 'VIEW_REPORTS_DASHBOARD'),
  ('admin', 'VIEW_FINANCIAL_DATA'),
  ('admin', 'SUBMIT_TIMESHEET'),
  ('admin', 'APPROVE_TIMESHEET'),
  ('admin', 'MANAGE_SYSTEM_SETTINGS'),
  ('operator', 'VIEW_ALL_PROJECTS'),
  ('operator', 'VIEW_ASSIGNED_PROJECTS'),
  ('operator', 'UPDATE_PROJECT_STATUS'),
  ('operator', 'ASSIGN_WORKERS_TO_PROJECTS'),
  ('operator', 'VIEW_ALL_USERS'),
  ('operator', 'VIEW_ALL_CLIENTS'),
  ('operator', 'VIEW_REPORTS_DASHBOARD'),
  ('operator', 'SUBMIT_TIMESHEET'),
  ('operator', 'APPROVE_TIMESHEET'),
  ('users', 'VIEW_ASSIGNED_PROJECTS'),
  ('users', 'SUBMIT_TIMESHEET');
