do $$
declare
  jobs_constraint_name text;
  usage_constraint_name text;
begin
  select con.conname
  into jobs_constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'jobs'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%tool_type%'
  limit 1;

  if jobs_constraint_name is not null then
    execute format('alter table public.jobs drop constraint %I', jobs_constraint_name);
  end if;

  alter table public.jobs
    add constraint jobs_tool_type_check
    check (tool_type in ('jpg_to_pdf', 'pdf_merge', 'pdf_compress', 'image_compress', 'pdf_to_images', 'webp_to_jpg'));

  select con.conname
  into usage_constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'usage_logs'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%tool_type%'
  limit 1;

  if usage_constraint_name is not null then
    execute format('alter table public.usage_logs drop constraint %I', usage_constraint_name);
  end if;

  alter table public.usage_logs
    add constraint usage_logs_tool_type_check
    check (tool_type in ('jpg_to_pdf', 'pdf_merge', 'pdf_compress', 'image_compress', 'pdf_to_images', 'webp_to_jpg'));
end $$;
