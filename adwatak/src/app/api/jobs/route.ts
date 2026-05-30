import { fail, ok } from "@/lib/api/responses";
import { JOB_LIMITS } from "@/lib/jobs/constants";
import { createJobSchema } from "@/lib/jobs/schemas";
import { createClient } from "@/lib/supabase/server";

function validateLimits(files: Array<{ sizeBytes: number }>) {
  if (files.length > JOB_LIMITS.maxFilesPerJob) {
    return `تجاوزت الحد المسموح لعدد الملفات (${JOB_LIMITS.maxFilesPerJob})`;
  }

  for (const file of files) {
    if (file.sizeBytes > JOB_LIMITS.maxFileSizeBytes) {
      return `أحد الملفات يتجاوز الحد المسموح (${Math.floor(JOB_LIMITS.maxFileSizeBytes / (1024 * 1024))}MB)`;
    }
  }

  const total = files.reduce((acc, file) => acc + file.sizeBytes, 0);
  if (total > JOB_LIMITS.maxTotalSizeBytes) {
    return `إجمالي حجم الملفات يتجاوز الحد المسموح (${Math.floor(JOB_LIMITS.maxTotalSizeBytes / (1024 * 1024))}MB)`;
  }

  return null;
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return fail("غير مصرح", 401);
  }

  const { data, error } = await supabase
    .from("jobs")
    .select("id, tool_type, status, progress, error_message, created_at, finished_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return fail("تعذر جلب المهام", 500, error.message);
  }

  return ok({ jobs: data });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return fail("يرجى تسجيل الدخول أولاً", 401);
  }

  const payload = await request.json().catch(() => null);
  const parsed = createJobSchema.safeParse(payload);

  if (!parsed.success) {
    return fail("البيانات المرسلة غير صحيحة", 400, parsed.error.flatten());
  }

  const limitError = validateLimits(parsed.data.inputFiles);
  if (limitError) {
    return fail(limitError, 400);
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      user_id: user.id,
      tool_type: parsed.data.toolType,
      status: "queued",
      progress: 0,
      options: {
        ...(parsed.data.options ?? {}),
        inputFileNames: parsed.data.inputFiles
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((file) => file.originalName ?? null),
      },
    })
    .select("id, status, progress, created_at")
    .single();

  if (jobError || !job) {
    return fail("تعذر إنشاء المهمة", 500, jobError?.message);
  }

  const filesToInsert = parsed.data.inputFiles.map((file) => ({
    job_id: job.id,
    kind: "input" as const,
    path: file.path,
    mime: file.mime,
    size_bytes: file.sizeBytes,
    order_index: file.orderIndex,
  }));

  const { error: filesError } = await supabase.from("job_files").insert(filesToInsert);

  if (filesError) {
    await supabase.from("jobs").update({ status: "failed", error_message: filesError.message }).eq("id", job.id);
    return fail("تم إنشاء المهمة لكن فشل حفظ الملفات", 500, filesError.message);
  }

  return ok({
    job,
    message: "تم إنشاء المهمة وإرسالها إلى طابور المعالجة",
    queue: { provider: "pending-phase-2", enqueued: false },
  });
}
