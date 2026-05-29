import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1),
  NEXT_PUBLIC_USE_SERVER_JPG_TO_PDF: z.enum(["true", "false"]).default("false"),
  NEXT_PUBLIC_MAX_FILES_PER_JOB: z.coerce.number().int().positive().default(20),
  NEXT_PUBLIC_MAX_FILE_SIZE_MB: z.coerce.number().positive().default(15),
  NEXT_PUBLIC_MAX_TOTAL_SIZE_MB: z.coerce.number().positive().default(150),
});

const parsedPublicEnv = publicEnvSchema.safeParse(process.env);

if (!parsedPublicEnv.success && typeof window === "undefined") {
  const issues = parsedPublicEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid public environment variables:\n${issues}`);
}

export const publicEnv = parsedPublicEnv.success
  ? parsedPublicEnv.data
  : {
      NEXT_PUBLIC_SUPABASE_URL: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
      NEXT_PUBLIC_USE_SERVER_JPG_TO_PDF: "false" as const,
      NEXT_PUBLIC_MAX_FILES_PER_JOB: 20,
      NEXT_PUBLIC_MAX_FILE_SIZE_MB: 15,
      NEXT_PUBLIC_MAX_TOTAL_SIZE_MB: 150,
    };

export const featureFlags = {
  useServerJpgToPdf: publicEnv.NEXT_PUBLIC_USE_SERVER_JPG_TO_PDF === "true",
} as const;
