import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_USE_SERVER_JPG_TO_PDF: z.enum(["true", "false"]).default("false"),
  NEXT_PUBLIC_MAX_FILES_PER_JOB: z.coerce.number().int().positive().default(20),
  NEXT_PUBLIC_MAX_FILE_SIZE_MB: z.coerce.number().positive().default(15),
  NEXT_PUBLIC_MAX_TOTAL_SIZE_MB: z.coerce.number().positive().default(150),
  WORKER_API_URL: z.string().url().optional(),
  WORKER_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;

export const featureFlags = {
  useServerJpgToPdf: env.NEXT_PUBLIC_USE_SERVER_JPG_TO_PDF === "true",
} as const;
