import "server-only";

import { z } from "zod";
import { publicEnv } from "@/lib/env/public";

const serverEnvSchema = z.object({
  APP_URL: z.string().trim().url().default("http://localhost:3000"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1).optional(),
  WORKER_API_URL: z.string().trim().url().optional(),
  WORKER_API_KEY: z.string().trim().optional(),
});

const parsedServerEnv = serverEnvSchema.safeParse(process.env);

if (!parsedServerEnv.success) {
  const issues = parsedServerEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid server environment variables:\n${issues}`);
}

export const serverEnv = {
  ...parsedServerEnv.data,
  NEXT_PUBLIC_SUPABASE_URL: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
} as const;
