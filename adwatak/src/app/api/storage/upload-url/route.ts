import { randomUUID } from "crypto";
import { z } from "zod";
import { fail, ok } from "@/lib/api/responses";
import { JOB_LIMITS, STORAGE_BUCKETS } from "@/lib/jobs/constants";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  files: z
    .array(
      z.object({
        fileName: z.string().min(1),
        contentType: z.string().min(1),
        sizeBytes: z.number().int().positive(),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("يرجى تسجيل الدخول أولاً", 401);
  }

  const payload = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(payload);

  if (!parsed.success) {
    return fail("البيانات المرسلة غير صحيحة", 400, parsed.error.flatten());
  }

  if (parsed.data.files.length > JOB_LIMITS.maxFilesPerJob) {
    return fail(`الحد الأقصى لعدد الملفات هو ${JOB_LIMITS.maxFilesPerJob}`, 400);
  }

  const totalSize = parsed.data.files.reduce((acc, file) => acc + file.sizeBytes, 0);
  if (totalSize > JOB_LIMITS.maxTotalSizeBytes) {
    return fail("إجمالي حجم الملفات أكبر من الحد المسموح", 400);
  }

  const uploads = [] as Array<{
    fileName: string;
    path: string;
    token: string;
    signedUploadUrl: string;
  }>;

  for (const file of parsed.data.files) {
    if (file.sizeBytes > JOB_LIMITS.maxFileSizeBytes) {
      return fail(`الملف ${file.fileName} يتجاوز الحد المسموح`, 400);
    }

    const path = `${user.id}/${randomUUID()}-${file.fileName}`;
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.inputs)
      .createSignedUploadUrl(path);

    if (error || !data) {
      return fail("تعذر إنشاء رابط الرفع", 500, error?.message);
    }

    uploads.push({
      fileName: file.fileName,
      path,
      token: data.token,
      signedUploadUrl: data.signedUrl,
    });
  }

  return ok({ uploads });
}
