-- Run this in Supabase Dashboard > SQL Editor for the NexGen website.
create extension if not exists pgcrypto;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  reference_code text unique,
  status text not null default 'Pending' check (status in ('Pending','Under Review','Approved','Rejected')),
  sender_name text,
  txn_id text,
  full_name text not null,
  gender text,
  gender_other text,
  age integer check (age is null or age between 10 and 100),
  city text not null,
  phone text not null,
  email text not null,
  applicant_status text,
  applicant_status_other text,
  association text,
  association_other text,
  designation text,
  heard_from text,
  heard_from_other text,
  why_join text,
  want_learn text,
  main_goal text,
  skills text[] default '{}',
  skills_other text,
  interest_areas text[] default '{}',
  interest_areas_other text,
  willing_active text,
  time_available text,
  willing_tasks text,
  opportunity text,
  join_volunteer text,
  preferred_area text,
  why_volunteer text,
  willing_contribute text,
  expectations text,
  anything_else text,
  files jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_created_at_idx on public.applications (created_at desc);
create index if not exists applications_status_idx on public.applications (status);
create index if not exists applications_email_idx on public.applications (email);
create index if not exists applications_phone_idx on public.applications (phone);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

alter table public.applications enable row level security;
-- No public policies are created. Netlify Functions use SUPABASE_SERVICE_ROLE_KEY server-side only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('application-files', 'application-files', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];
