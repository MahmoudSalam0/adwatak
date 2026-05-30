import { fail, ok } from "@/lib/api/responses";
import { STORAGE_BUCKETS } from "@/lib/jobs/constants";
import { buildPdfFromImages, compressPdfBytes, mergePdfFiles, renderPdfPagesToImages } from "@/lib/jobs/serverPdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ToolType } from "@/lib/supabase/types";
import sharp from "sharp";
import JSZip from "jszip";

interface Params {
  params: { id: string };
}

type PngMode = "auto" | "keep-png" | "to-webp" | "to-jpg";
type PdfQuality = "low" | "medium" | "high";
type PdfImageFormat = "jpg" | "png";

function getInputFileNames(options: Record<string, unknown> | null | undefined): string[] {
  const names = options?.inputFileNames;
  if (!Array.isArray(names)) return [];
  return names.map((name) => (typeof name === "string" ? name : ""));
}

function normalizePdfQuality(value: unknown): PdfQuality {
  if (value === "low" || value === "high") return value;
  return "medium";
}

function normalizePngMode(value: unknown): PngMode {
  if (value === "keep-png" || value === "to-webp" || value === "to-jpg") return value;
  return "auto";
}

function normalizePdfImageFormat(value: unknown): PdfImageFormat {
  if (value === "png") return "png";
  return "jpg";
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
    .select("id, tool_type, status, options")
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

  if (
    job.tool_type !== "jpg_to_pdf" &&
    job.tool_type !== "pdf_merge" &&
    job.tool_type !== "image_compress" &&
    job.tool_type !== "pdf_compress" &&
    job.tool_type !== "pdf_to_images"
  ) {
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

    const options = (job.options as Record<string, unknown> | null) ?? {};
    const inputFileNames = getInputFileNames(options);

    let outputBytes: Uint8Array;
    let outputPath: string;
    let mimeType: string;
    let report: Record<string, unknown> = {};

    if (job.tool_type === "jpg_to_pdf") {
      const pdfQuality = normalizePdfQuality(options.quality);
      outputBytes = await buildPdfFromImages(inputs, pdfQuality);
      outputPath = `${user.id}/${job.id}/output.pdf`;
      mimeType = "application/pdf";
      report = {
        quality: pdfQuality,
        originalSize: inputTotalBytes,
        outputSize: outputBytes.byteLength,
        savingsBytes: inputTotalBytes - outputBytes.byteLength,
        savingsPercentage: inputTotalBytes > 0 ? ((inputTotalBytes - outputBytes.byteLength) / inputTotalBytes) * 100 : 0,
      };
    } else if (job.tool_type === "pdf_merge") {
      outputBytes = await mergePdfFiles(inputs.map((input) => input.bytes));
      outputPath = `${user.id}/${job.id}/output.pdf`;
      mimeType = "application/pdf";
      report = {
        originalSize: inputTotalBytes,
        outputSize: outputBytes.byteLength,
        savingsBytes: inputTotalBytes - outputBytes.byteLength,
        savingsPercentage: inputTotalBytes > 0 ? ((inputTotalBytes - outputBytes.byteLength) / inputTotalBytes) * 100 : 0,
      };
    } else if (job.tool_type === "image_compress") {
      const qualityValue = typeof options.quality === "number" ? options.quality : 75;
      const quality = Math.max(60, Math.min(85, Math.round(qualityValue)));
      const force = false;
      const pngMode = normalizePngMode(options.pngMode);
      const zip = new JSZip();
      const fileReports: Array<Record<string, unknown>> = [];
      let outputImagesTotal = 0;
      let skippedCount = 0;

      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const metadata = await sharp(input.bytes).metadata();
        const hasAlpha = Boolean(metadata.hasAlpha);
        const isPngInput = input.mime === "image/png";

        let compressed: Buffer;
        let ext = "jpg";
        let outputMime = "image/jpeg";

        if (isPngInput) {
          if (pngMode === "keep-png") {
            compressed = await sharp(input.bytes).png({ compressionLevel: 9 }).toBuffer();
            ext = "png";
            outputMime = "image/png";
          } else if (pngMode === "to-webp" || (pngMode === "auto" && hasAlpha)) {
            compressed = await sharp(input.bytes).webp({ quality }).toBuffer();
            ext = "webp";
            outputMime = "image/webp";
          } else {
            compressed = await sharp(input.bytes).jpeg({ quality, mozjpeg: true }).toBuffer();
            ext = "jpg";
            outputMime = "image/jpeg";
          }
        } else {
          compressed = await sharp(input.bytes).jpeg({ quality, mozjpeg: true }).toBuffer();
          ext = "jpg";
          outputMime = "image/jpeg";
        }

        const shouldSkip = !force && compressed.byteLength >= input.bytes.byteLength;
        if (shouldSkip) {
          skippedCount += 1;
        } else {
          zip.file(`compressed-${i + 1}.${ext}`, compressed);
          outputImagesTotal += compressed.byteLength;
        }

        const sourceName = inputFileNames[i] || files[i]?.path?.split("/").pop() || `file-${i + 1}`;

        fileReports.push({
          index: i,
          sourceName,
          inputSize: input.bytes.byteLength,
          outputSize: compressed.byteLength,
          outputMime,
          skipped: shouldSkip,
          savingsBytes: input.bytes.byteLength - compressed.byteLength,
          savingsPercentage:
            input.bytes.byteLength > 0
              ? ((input.bytes.byteLength - compressed.byteLength) / input.bytes.byteLength) * 100
              : 0,
        });
      }

      if (zip.files && Object.keys(zip.files).length === 0) {
        throw new Error("لم يتم إنشاء ملفات مضغوطة أصغر من الأصل. فعّل خيار force لإجبار التصدير.");
      }

      const zipBuffer = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 9 } });
      outputBytes = zipBuffer;
      outputPath = `${user.id}/${job.id}/output.zip`;
      mimeType = "application/zip";
      report = {
        quality,
        force: false,
        pngMode,
        originalSize: inputTotalBytes,
        outputSize: outputBytes.byteLength,
        compressedImagesSize: outputImagesTotal,
        skippedCount,
        processedCount: inputs.length,
        savingsBytes: inputTotalBytes - outputBytes.byteLength,
        savingsPercentage: inputTotalBytes > 0 ? ((inputTotalBytes - outputBytes.byteLength) / inputTotalBytes) * 100 : 0,
        files: fileReports,
      };
    } else if (job.tool_type === "pdf_compress") {
      const zip = new JSZip();
      const fileReports: Array<Record<string, unknown>> = [];
      let improvedCount = 0;
      let skippedCount = 0;
      let improvedTotal = 0;
      let smallCount = 0;

      const minCompressSizeBytes = 100 * 1024;

      for (let i = 0; i < inputs.length; i++) {
        const original = inputs[i].bytes;
        const sourcePath = files[i]?.path ?? `input-${i + 1}.pdf`;
        const sourceName = inputFileNames[i] || sourcePath.split("/").pop() || sourcePath;

        if (original.byteLength < minCompressSizeBytes) {
          smallCount += 1;
          skippedCount += 1;
          fileReports.push({
            index: i,
            sourceName,
            inputSize: original.byteLength,
            outputSize: original.byteLength,
            improved: false,
            skipped: true,
            skipReason: "small_file_under_100kb",
            message: "هذا الملف صغير جدًا (أقل من 100KB) وتأثير الضغط محدود.",
            savingsBytes: 0,
            savingsPercentage: 0,
          });
          continue;
        }

        try {
          const compressed = await compressPdfBytes(original);
          const improved = compressed.byteLength < original.byteLength;
          const fileName = `compressed-${i + 1}.pdf`;

          if (improved) {
            improvedCount += 1;
            improvedTotal += compressed.byteLength;
            zip.file(fileName, compressed);
          } else {
            skippedCount += 1;
          }

          const savingsBytes = original.byteLength - compressed.byteLength;
          const savingsPercentage =
            original.byteLength > 0 ? (savingsBytes / original.byteLength) * 100 : 0;

          fileReports.push({
            index: i,
            sourceName,
            inputSize: original.byteLength,
            outputSize: compressed.byteLength,
            improved,
            skipped: !improved,
            skipReason: improved ? null : "no_size_improvement",
            message: improved ? "تم الضغط بنجاح" : "هذا الملف مضغوط مسبقًا أو لا يمكن تقليل حجمه أكثر",
            savingsBytes,
            savingsPercentage,
          });

          console.info("[jobs.process][pdf_compress] file-result", {
            jobId: job.id,
            index: i,
            sourceName,
            inputSize: original.byteLength,
            outputSize: compressed.byteLength,
            savingsBytes,
            savingsPercentage,
            skipped: !improved,
            skipReason: improved ? null : "no_size_improvement",
          });
        } catch (compressError) {
          skippedCount += 1;
          const reason =
            compressError instanceof Error
              ? compressError.message
              : "فشل غير متوقع أثناء ضغط الملف";

          fileReports.push({
            index: i,
            sourceName,
            inputSize: original.byteLength,
            outputSize: null,
            improved: false,
            skipped: true,
            skipReason: "compress_error",
            message: "تعذر ضغط هذا الملف، وتم تخطيه.",
            error: reason,
            savingsBytes: 0,
            savingsPercentage: 0,
          });

          console.error("[jobs.process][pdf_compress] file-error", {
            jobId: job.id,
            index: i,
            sourceName,
            inputSize: original.byteLength,
            skipReason: "compress_error",
            error: reason,
          });
        }
      }

      const allSkipped = improvedCount === 0;

      if (improvedCount === 1) {
        const first = Object.values(zip.files)[0];
        outputBytes = await first.async("uint8array");
        outputPath = `${user.id}/${job.id}/output.pdf`;
        mimeType = "application/pdf";
      } else if (improvedCount > 1) {
        outputBytes = await zip.generateAsync({
          type: "uint8array",
          compression: "DEFLATE",
          compressionOptions: { level: 9 },
        });
        outputPath = `${user.id}/${job.id}/output.zip`;
        mimeType = "application/zip";
      } else {
        outputBytes = new Uint8Array();
        outputPath = "";
        mimeType = "application/octet-stream";
      }

      report = {
        originalSize: inputTotalBytes,
        outputSize: improvedCount > 0 ? outputBytes.byteLength : inputTotalBytes,
        improvedContentSize: improvedTotal,
        improvedCount,
        skippedCount,
        smallCount,
        hasDownload: improvedCount > 0,
        allSkipped,
        summaryMessage:
          improvedCount > 0
            ? "تم ضغط بعض الملفات، وتم تخطي الملفات غير القابلة للتحسين."
            : "كل الملفات مضغوطة مسبقًا أو لا يمكن تقليلها أكثر.",
        savingsBytes: improvedCount > 0 ? inputTotalBytes - outputBytes.byteLength : 0,
        savingsPercentage:
          improvedCount > 0 && inputTotalBytes > 0
            ? ((inputTotalBytes - outputBytes.byteLength) / inputTotalBytes) * 100
            : 0,
        files: fileReports,
      };

      console.info("[jobs.process][pdf_compress] summary", {
        jobId: job.id,
        inputTotalBytes,
        outputTotalBytes: improvedCount > 0 ? outputBytes.byteLength : null,
        improvedCount,
        skippedCount,
        smallCount,
        allSkipped,
      });
    } else {
      const format = normalizePdfImageFormat(options.format);
      const imageQuality = normalizePdfQuality(options.quality);
      const pageImages = await renderPdfPagesToImages(inputs[0].bytes, format, imageQuality);
      const zip = new JSZip();
      let imagesTotalBytes = 0;

      for (const pageImage of pageImages) {
        zip.file(pageImage.fileName, pageImage.bytes);
        imagesTotalBytes += pageImage.bytes.byteLength;
      }

      outputBytes = await zip.generateAsync({
        type: "uint8array",
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
      });
      outputPath = `${user.id}/${job.id}/output.zip`;
      mimeType = "application/zip";
      report = {
        originalSize: inputTotalBytes,
        outputSize: outputBytes.byteLength,
        pageCount: pageImages.length,
        imageFormat: format,
        quality: imageQuality,
        averageImageSize: pageImages.length > 0 ? Math.round(imagesTotalBytes / pageImages.length) : 0,
        note: "قد يكون حجم الصور الناتجة أكبر من ملف PDF الأصلي حسب الجودة وعدد الصفحات.",
      };
    }

    if (outputBytes.byteLength > 0 && outputPath) {
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
        throw new Error(`تعذر رفع ملف الناتج: ${uploadError.message}`);
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
        mime: mimeType,
        size_bytes: outputBytes.byteLength,
        order_index: 0,
      });

      if (outputInsertError) {
        throw new Error("تعذر حفظ ملف المخرجات في قاعدة البيانات");
      }
    }

    await supabase
      .from("jobs")
      .update({
        status: "completed",
        progress: 100,
        finished_at: new Date().toISOString(),
        options: { ...((job.options as Record<string, unknown> | null) ?? {}), resultReport: report },
      })
      .eq("id", job.id);

    const durationMs = Date.now() - startedAt.getTime();
    await supabase.from("usage_logs").insert({
      user_id: user.id,
      tool_type: job.tool_type as ToolType,
      job_id: job.id,
      duration_ms: durationMs,
      input_total_bytes: inputTotalBytes,
      output_total_bytes: outputBytes.byteLength,
      status: "completed",
    });

    return ok({ status: "completed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "حدث خطأ أثناء المعالجة";

    console.error("[jobs.process] fatal-error", {
      jobId: job.id,
      toolType: job.tool_type,
      message,
    });

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
      tool_type: job.tool_type as ToolType,
      job_id: job.id,
      duration_ms: durationMs,
      status: "failed",
    });

    return fail(message, 500);
  }
}
