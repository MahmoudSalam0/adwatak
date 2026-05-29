# Supabase Foundation Setup

## 1) Create project settings in Vercel

Add these environment variables in Vercel and local `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_URL`
- `NEXT_PUBLIC_USE_SERVER_JPG_TO_PDF`

Optional for phase 2 worker:

- `WORKER_API_URL`
- `WORKER_API_KEY`

## 2) Run schema

Open Supabase SQL editor and run `supabase/schema.sql`.

This creates:

- Tables: `profiles`, `jobs`, `job_files`, `usage_logs`
- Indexes and constraints
- Trigger for profile creation on new user
- RLS policies for tables and storage
- Storage buckets: `job-inputs`, `job-outputs`

## 3) Auth settings

In Supabase Auth -> URL Configuration:

- Site URL: `https://<your-vercel-domain>`
- Redirect URLs:
  - `https://<your-vercel-domain>/auth/callback`
  - `http://localhost:3000/auth/callback`

## 4) Verify foundation APIs

- `GET /api/health`
- `GET /api/jobs` (requires auth)
- `POST /api/storage/upload-url` (requires auth)
