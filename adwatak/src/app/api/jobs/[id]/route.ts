import { fail, ok } from "@/lib/api/responses";
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
    return fail("غير مصرح", 401);
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .select("id, status, tool_type, progress, error_message, created_at, started_at, finished_at, options")
    .eq("id", params.id)
    .single();

  if (error || !job) {
    return fail("المهمة غير موجودة", 404);
  }

  const { data: output } = await supabase
    .from("job_files")
    .select("path")
    .eq("job_id", params.id)
    .eq("kind", "output")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return ok({ job, outputPath: output?.path ?? null });
}
