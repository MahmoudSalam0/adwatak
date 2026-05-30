import { z } from "zod";

export const createJobSchema = z.object({
  toolType: z.enum(["jpg_to_pdf", "pdf_merge", "image_compress", "pdf_compress"]),
  inputFiles: z
    .array(
      z.object({
        path: z.string().min(1),
        mime: z.string().min(1),
        sizeBytes: z.number().int().positive(),
        orderIndex: z.number().int().nonnegative(),
        originalName: z.string().min(1).optional(),
      }),
    )
    .min(1),
  options: z.record(z.string(), z.unknown()).optional(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
