create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.saved_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  container_type text,
  scene jsonb not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  company text,
  message text,
  source text not null default 'packet-opt-control-tower',
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.report_deliveries (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  subject text not null,
  summary jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  provider_message_id text,
  created_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_saved_plans_updated_at on public.saved_plans;
create trigger trg_saved_plans_updated_at
before update on public.saved_plans
for each row
execute function public.set_updated_at();

alter table public.saved_plans enable row level security;
alter table public.crm_leads enable row level security;
alter table public.report_deliveries enable row level security;

drop policy if exists "saved_plans_select_own" on public.saved_plans;
create policy "saved_plans_select_own"
on public.saved_plans
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "saved_plans_insert_own" on public.saved_plans;
create policy "saved_plans_insert_own"
on public.saved_plans
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "saved_plans_update_own" on public.saved_plans;
create policy "saved_plans_update_own"
on public.saved_plans
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "saved_plans_delete_own" on public.saved_plans;
create policy "saved_plans_delete_own"
on public.saved_plans
for delete
to authenticated
using (auth.uid() = user_id);
