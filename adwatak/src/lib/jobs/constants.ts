import { env } from "@/lib/env";

export const JOB_LIMITS = {
  maxFilesPerJob: env.NEXT_PUBLIC_MAX_FILES_PER_JOB,
  maxFileSizeBytes: env.NEXT_PUBLIC_MAX_FILE_SIZE_MB * 1024 * 1024,
  maxTotalSizeBytes: env.NEXT_PUBLIC_MAX_TOTAL_SIZE_MB * 1024 * 1024,
} as const;

export const STORAGE_BUCKETS = {
  inputs: "job-inputs",
  outputs: "job-outputs",
} as const;
