import { publicEnv } from "@/lib/env/public";

export const JOB_LIMITS = {
  maxFilesPerJob: publicEnv.NEXT_PUBLIC_MAX_FILES_PER_JOB,
  maxFileSizeBytes: publicEnv.NEXT_PUBLIC_MAX_FILE_SIZE_MB * 1024 * 1024,
  maxTotalSizeBytes: publicEnv.NEXT_PUBLIC_MAX_TOTAL_SIZE_MB * 1024 * 1024,
} as const;

export const STORAGE_BUCKETS = {
  inputs: "job-inputs",
  outputs: "job-outputs",
} as const;
