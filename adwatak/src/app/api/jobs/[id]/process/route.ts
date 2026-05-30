import { fail, ok } from "@/lib/api/responses";
import { STORAGE_BUCKETS } from "@/lib/jobs/constants";
import { buildPdfFromImages } from "@/lib/jobs/serverPdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: { id: string };
}

export async function POST(_request: Request, { params }: Params) {
  const supabase = createClient();
  const admin = createAdminClient();
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

  const startedAt = new Date();

  await supabase
    .from("jobs")
    .update({ status: "processing", progress: 5, started_at: startedAt.toISOString(), error_message: null })
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
    let inputTotalBytes = 0;

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
      inputTotalBytes += bytes.byteLength;
      inputs.push({ bytes, mime: file.mime ?? "image/jpeg" });
    }

    await supabase.from("jobs").update({ progress: 80 }).eq("id", job.id);

    const outputBytes = await buildPdfFromImages(inputs);
    const outputPath = `${user.id}/${job.id}/output.pdf`;
    const mimeType = "application/pdf";
    const fileSize = outputBytes.byteLength;

    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKETS.outputs)
      .upload(outputPath, outputBytes, {
        upsert: true,
        contentType: mimeType,
      });

    if (uploadError) {
      console.error("[jobs.process] output upload failed", {
        jobId: job.id,
        userId: user.id,
        outputPath,
        mimeType,
        fileSize,
        uploadError: {
          name: uploadError.name,
          message: uploadError.message,
        },
      });
      throw new Error(`تعذر رفع ملف PDF الناتج: ${uploadError.message}`);
    }

    console.info("[jobs.process] output upload success", {
      jobId: job.id,
      userId: user.id,
      outputPath,
      mimeType,
      fileSize,
    });

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

    const durationMs = Date.now() - startedAt.getTime();
    await supabase.from("usage_logs").insert({
      user_id: user.id,
      tool_type: "jpg_to_pdf",
      job_id: job.id,
      duration_ms: durationMs,
      input_total_bytes: inputTotalBytes,
      output_total_bytes: outputBytes.byteLength,
      status: "completed",
    });

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

    const durationMs = Date.now() - startedAt.getTime();
    await supabase.from("usage_logs").insert({
      user_id: user.id,
      tool_type: "jpg_to_pdf",
      job_id: job.id,
      duration_ms: durationMs,
      status: "failed",
    });

    return fail(message, 500);
  }
}
