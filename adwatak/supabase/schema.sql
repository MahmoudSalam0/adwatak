-- Enable required extension
create extension if not exists "pgcrypto";

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Jobs
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_type text not null check (tool_type in ('jpg_to_pdf', 'pdf_merge', 'pdf_compress', 'image_compress', 'pdf_to_images', 'webp_to_jpg')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  options jsonb not null default '{}'::jsonb,
  progress int not null default 0 check (progress >= 0 and progress <= 100),
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists jobs_user_id_idx on public.jobs(user_id);
create index if not exists jobs_status_idx on public.jobs(status);
create index if not exists jobs_created_at_idx on public.jobs(created_at desc);

-- Job files
create table if not exists public.job_files (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  kind text not null check (kind in ('input', 'output')),
  path text not null,
  mime text,
  size_bytes bigint,
  order_index int,
  created_at timestamptz not null default now()
);

create index if not exists job_files_job_id_idx on public.job_files(job_id);
create index if not exists job_files_kind_idx on public.job_files(kind);

-- Usage logs
create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_type text not null check (tool_type in ('jpg_to_pdf', 'pdf_merge', 'pdf_compress', 'image_compress', 'pdf_to_images', 'webp_to_jpg')),
  job_id uuid references public.jobs(id) on delete set null,
  duration_ms int,
  input_total_bytes bigint,
  output_total_bytes bigint,
  status text not null check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists usage_logs_user_id_idx on public.usage_logs(user_id);
create index if not exists usage_logs_created_at_idx on public.usage_logs(created_at desc);

-- Keep profiles in sync with auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row level security
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.job_files enable row level security;
alter table public.usage_logs enable row level security;

-- profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- jobs policies
drop policy if exists "jobs_select_own" on public.jobs;
create policy "jobs_select_own"
  on public.jobs for select
  using (auth.uid() = user_id);

drop policy if exists "jobs_insert_own" on public.jobs;
create policy "jobs_insert_own"
  on public.jobs for insert
  with check (auth.uid() = user_id);

drop policy if exists "jobs_update_own" on public.jobs;
create policy "jobs_update_own"
  on public.jobs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- job_files policies
drop policy if exists "job_files_select_own" on public.job_files;
create policy "job_files_select_own"
  on public.job_files for select
  using (
    exists (
      select 1
      from public.jobs j
      where j.id = job_files.job_id
        and j.user_id = auth.uid()
    )
  );

drop policy if exists "job_files_insert_own" on public.job_files;
create policy "job_files_insert_own"
  on public.job_files for insert
  with check (
    exists (
      select 1
      from public.jobs j
      where j.id = job_files.job_id
        and j.user_id = auth.uid()
    )
  );

drop policy if exists "job_files_update_own" on public.job_files;
create policy "job_files_update_own"
  on public.job_files for update
  using (
    exists (
      select 1
      from public.jobs j
      where j.id = job_files.job_id
        and j.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.jobs j
      where j.id = job_files.job_id
        and j.user_id = auth.uid()
    )
  );

-- usage_logs policies
drop policy if exists "usage_logs_select_own" on public.usage_logs;
create policy "usage_logs_select_own"
  on public.usage_logs for select
  using (auth.uid() = user_id);

drop policy if exists "usage_logs_insert_own" on public.usage_logs;
create policy "usage_logs_insert_own"
  on public.usage_logs for insert
  with check (auth.uid() = user_id);

-- Storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'job-inputs',
    'job-inputs',
    false,
    15728640,
    array['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/gif', 'application/pdf']
  ),
  (
    'job-outputs',
    'job-outputs',
    false,
    209715200,
    array['application/pdf', 'application/zip']
  )
on conflict (id) do nothing;

-- Storage RLS policies
drop policy if exists "inputs_select_own" on storage.objects;
create policy "inputs_select_own"
  on storage.objects for select
  using (
    bucket_id = 'job-inputs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "inputs_insert_own" on storage.objects;
create policy "inputs_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'job-inputs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "outputs_select_own" on storage.objects;
create policy "outputs_select_own"
  on storage.objects for select
  using (
    bucket_id = 'job-outputs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
