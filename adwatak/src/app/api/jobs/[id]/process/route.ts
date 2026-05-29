import { fail, ok } from "@/lib/api/responses";
import { STORAGE_BUCKETS } from "@/lib/jobs/constants";
import { buildPdfFromImages } from "@/lib/jobs/serverPdf";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: { id: string };
}

export async function POST(_request: Request, { params }: Params) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("يرجى تسجيل الدخول أولاً", 401);
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, tool_type, status")
    .eq("id", params.id)
    .single();

  if (jobError || !job) {
    return fail("المهمة غير موجودة", 404);
  }

  if (job.status === "processing") {
    return ok({ status: "processing", message: "المهمة قيد المعالجة بالفعل" });
  }

  if (job.status === "completed") {
    return ok({ status: "completed", message: "المهمة مكتملة بالفعل" });
  }

  if (job.tool_type !== "jpg_to_pdf") {
    return fail("نوع المهمة غير مدعوم حالياً", 400);
  }

  await supabase
    .from("jobs")
    .update({ status: "processing", progress: 5, started_at: new Date().toISOString(), error_message: null })
    .eq("id", job.id);

  try {
    const { data: files, error: filesError } = await supabase
      .from("job_files")
      .select("path, mime, order_index")
      .eq("job_id", job.id)
      .eq("kind", "input")
      .order("order_index", { ascending: true });

    if (filesError || !files || files.length === 0) {
      throw new Error("لا توجد ملفات إدخال للمهمة");
    }

    const inputs: Array<{ bytes: Uint8Array; mime: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const currentProgress = Math.min(70, 10 + Math.floor((i / files.length) * 60));
      await supabase.from("jobs").update({ progress: currentProgress }).eq("id", job.id);

      const file = files[i];
      const { data: blob, error: downloadError } = await supabase.storage
        .from(STORAGE_BUCKETS.inputs)
        .download(file.path);

      if (downloadError || !blob) {
        throw new Error(`تعذر تحميل الملف: ${file.path}`);
      }

      const bytes = new Uint8Array(await blob.arrayBuffer());
      inputs.push({ bytes, mime: file.mime ?? "image/jpeg" });
    }

    await supabase.from("jobs").update({ progress: 80 }).eq("id", job.id);

    const outputBytes = await buildPdfFromImages(inputs);
    const outputPath = `${user.id}/${job.id}/result.pdf`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.outputs)
      .upload(outputPath, outputBytes, {
        upsert: true,
        contentType: "application/pdf",
      });

    if (uploadError) {
      throw new Error("تعذر رفع ملف PDF الناتج");
    }

    const { error: outputInsertError } = await supabase.from("job_files").insert({
      job_id: job.id,
      kind: "output",
      path: outputPath,
      mime: "application/pdf",
      size_bytes: outputBytes.byteLength,
      order_index: 0,
    });

    if (outputInsertError) {
      throw new Error("تعذر حفظ ملف المخرجات في قاعدة البيانات");
    }

    await supabase
      .from("jobs")
      .update({ status: "completed", progress: 100, finished_at: new Date().toISOString() })
      .eq("id", job.id);

    return ok({ status: "completed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "حدث خطأ أثناء المعالجة";

    await supabase
      .from("jobs")
      .update({
        status: "failed",
        progress: 0,
        error_message: message,
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return fail(message, 500);
  }
}
