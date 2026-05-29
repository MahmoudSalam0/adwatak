import { fail, ok } from "@/lib/api/responses";
import { STORAGE_BUCKETS } from "@/lib/jobs/constants";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: { id: string };
}

export async function GET(_request: Request, { params }: Params) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("يرجى تسجيل الدخول أولاً", 401);
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, status")
    .eq("id", params.id)
    .single();

  if (!job) {
    return fail("المهمة غير موجودة", 404);
  }

  if (job.status !== "completed") {
    return fail("المهمة لم تكتمل بعد", 400);
  }

  const { data: output } = await supabase
    .from("job_files")
    .select("path")
    .eq("job_id", params.id)
    .eq("kind", "output")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!output?.path) {
    return fail("ملف الإخراج غير متوفر", 404);
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.outputs)
    .createSignedUrl(output.path, 60 * 10);

  if (error || !data?.signedUrl) {
    return fail("تعذر إنشاء رابط التحميل", 500, error?.message);
  }

  return ok({ url: data.signedUrl });
}
