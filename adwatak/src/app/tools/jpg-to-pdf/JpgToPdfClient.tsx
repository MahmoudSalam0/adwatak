"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageUp, FileText, Download, RotateCcw, AlertCircle, Loader2, Trash2 } from "lucide-react";
import ToolLayout from "@/components/tools/ToolLayout";
import DropZone from "@/components/tools/DropZone";
import ImagePreviewCard from "@/components/tools/ImagePreviewCard";
import Button from "@/components/ui/Button";
import FadeIn from "@/components/animations/FadeIn";
import { useImageUpload } from "@/hooks/useImageUpload";
import { convertToPdf, downloadPdf } from "@/lib/pdfUtils";
import { uploadWithProgress } from "@/lib/jobs/upload";

type ServerJobStatus = "queued" | "processing" | "completed" | "failed";
type PdfQuality = "low" | "medium" | "high";

interface JobReport {
  originalSize: number;
  outputSize: number;
  savingsPercentage: number;
}

interface JobOptionsPayload {
  resultReport?: JobReport;
  inputFileNames?: Array<string | null>;
}

const USE_SERVER_FLOW = process.env.NEXT_PUBLIC_USE_SERVER_JPG_TO_PDF === "true";

function statusToArabic(status: ServerJobStatus): string {
  if (status === "queued") return "في الانتظار";
  if (status === "processing") return "جاري المعالجة";
  if (status === "completed") return "جاهز للتحميل";
  return "فشلت العملية";
}

export default function JpgToPdfClient() {
  const {
    images,
    errors,
    isProcessing,
    setIsProcessing,
    addImages,
    removeImage,
    moveUp,
    moveDown,
    clearAll,
    clearErrors,
  } = useImageUpload({ maxFiles: 50, maxSize: 20 });

  const [status, setStatus] = useState<"idle" | "converting" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobStatus, setJobStatus] = useState<ServerJobStatus | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quality, setQuality] = useState<PdfQuality>("medium");
  const [report, setReport] = useState<JobReport | null>(null);
  const [inputFileNames, setInputFileNames] = useState<string[]>([]);

  const isBusy = isProcessing || isSubmitting;

  const pollJobStatus = useCallback(async (id: string) => {
    while (true) {
      const response = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "تعذر متابعة حالة المهمة");
      }

      const nextStatus = payload?.data?.job?.status as ServerJobStatus;
      const nextProgress = payload?.data?.job?.progress as number;
      const errorMessage = payload?.data?.job?.error_message as string | null;
      const options = payload?.data?.job?.options as JobOptionsPayload | undefined;
      const resultReport = options?.resultReport;

      setJobStatus(nextStatus);
      setJobProgress(nextProgress ?? 0);
      if (resultReport) setReport(resultReport);
      setInputFileNames((options?.inputFileNames ?? []).filter((name): name is string => typeof name === "string" && name.length > 0));

      if (nextStatus === "completed") {
        const downloadRes = await fetch(`/api/jobs/${id}/download`, { cache: "no-store" });
        const downloadPayload = await downloadRes.json();
        if (downloadRes.ok) {
          setDownloadUrl(downloadPayload?.data?.url ?? null);
        }
        setStatus("success");
        setStatusMessage("تم إنشاء ملف PDF بنجاح");
        return;
      }

      if (nextStatus === "failed") {
        setStatus("error");
        setStatusMessage(errorMessage ?? "فشلت عملية التحويل");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }, []);

  const handleServerConvert = useCallback(async () => {
    if (images.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setIsProcessing(true);
    setStatus("converting");
    setStatusMessage("جاري رفع الملفات...");
    setUploadProgress(0);
    setJobProgress(0);
    setJobStatus(null);
    setJobId(null);
    setDownloadUrl(null);
    setReport(null);
    setInputFileNames([]);

    try {
      const uploadReq = await fetch("/api/storage/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: images.map((img) => ({
            fileName: img.file.name,
            contentType: img.file.type || "application/octet-stream",
            sizeBytes: img.file.size,
          })),
        }),
      });

      const uploadPayload = await uploadReq.json();

      if (!uploadReq.ok) {
        throw new Error(uploadPayload?.error?.message ?? "تعذر إنشاء روابط الرفع");
      }

      const uploads = uploadPayload?.data?.uploads as Array<{ path: string; signedUploadUrl: string }>;
      let uploadedBytes = 0;
      const totalBytes = images.reduce((acc, img) => acc + img.file.size, 0);

      for (let i = 0; i < uploads.length; i++) {
        const file = images[i].file;
        await uploadWithProgress(uploads[i].signedUploadUrl, file, (fileProgress) => {
          const fileLoaded = Math.round((fileProgress / 100) * file.size);
          const absolute = uploadedBytes + fileLoaded;
          setUploadProgress(Math.min(100, Math.round((absolute / totalBytes) * 100)));
        });
        uploadedBytes += file.size;
        setUploadProgress(Math.min(100, Math.round((uploadedBytes / totalBytes) * 100)));
      }

      setStatusMessage("جاري تجهيز المهمة...");

      const createJobRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolType: "jpg_to_pdf",
          inputFiles: uploads.map((upload, index) => ({
            path: upload.path,
            mime: images[index].file.type || "image/jpeg",
            sizeBytes: images[index].file.size,
            orderIndex: index,
            originalName: images[index].file.name,
          })),
          options: { quality },
        }),
      });

      const createPayload = await createJobRes.json();
      if (!createJobRes.ok) {
        throw new Error(createPayload?.error?.message ?? "تعذر إنشاء المهمة");
      }

      const id = createPayload?.data?.job?.id as string;
      setJobId(id);
      setJobStatus("queued");

      const processRes = await fetch(`/api/jobs/${id}/process`, { method: "POST" });
      if (!processRes.ok) {
        const processPayload = await processRes.json();
        throw new Error(processPayload?.error?.message ?? "تعذر بدء المعالجة");
      }

      await pollJobStatus(id);
    } catch (err) {
      setStatus("error");
      setStatusMessage(err instanceof Error ? err.message : "حدث خطأ أثناء التحويل");
    } finally {
      setIsSubmitting(false);
      setIsProcessing(false);
    }
  }, [images, isSubmitting, pollJobStatus, quality, setIsProcessing]);

  const handleConvert = useCallback(async () => {
    if (USE_SERVER_FLOW) {
      await handleServerConvert();
      return;
    }

    if (images.length === 0) return;

    setStatus("converting");
    setStatusMessage("جاري تحويل الصور إلى PDF...");
    setIsProcessing(true);

    try {
      const blob = await convertToPdf(images.map((img) => ({ file: img.file, preview: img.preview })));
      downloadPdf(blob, "images.pdf");
      setStatus("success");
      setStatusMessage("تم إنشاء ملف PDF بنجاح!");
    } catch (err) {
      setStatus("error");
      setStatusMessage(err instanceof Error ? err.message : "حدث خطأ أثناء التحويل");
    } finally {
      setIsProcessing(false);
    }
  }, [handleServerConvert, images, setIsProcessing]);

  const handleReset = useCallback(() => {
    clearAll();
    setStatus("idle");
    setStatusMessage("");
    setUploadProgress(0);
    setJobProgress(0);
    setJobStatus(null);
    setJobId(null);
    setDownloadUrl(null);
    setReport(null);
    setInputFileNames([]);
  }, [clearAll]);

  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

  const totalSize = images.reduce((acc, img) => acc + img.file.size, 0);
  const sizeText =
    totalSize < 1024 * 1024
      ? (totalSize / 1024).toFixed(0) + " KB"
      : (totalSize / (1024 * 1024)).toFixed(1) + " MB";

  return (
    <ToolLayout
      title="تحويل الصور إلى PDF"
      description="حوّل صور JPG و PNG و WebP إلى PDF بجودة عالية وبضغطة زر"
      icon={<ImageUp className="h-7 w-7 text-white" />}
      gradient="from-blue-500 to-indigo-600"
    >
      <div className="space-y-6">
        {/* Errors */}
        <AnimatePresence>
          {errors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4"
            >
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                {errors.map((err, i) => (
                  <p key={i} className="text-sm text-red-300">
                    {err}
                  </p>
                ))}
              </div>
              <button
                onClick={clearErrors}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                إخفاء
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* DropZone */}
        <FadeIn key="dropzone">
          <DropZone
            onFilesSelected={addImages}
            disabled={isProcessing}
            dropLabel="الصور"
          />
        </FadeIn>

        {/* Image list */}
        <AnimatePresence mode="popLayout">
          {images.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="space-y-4"
            >
              {USE_SERVER_FLOW && status === "converting" && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <span>{uploadProgress < 100 ? "جاري رفع الملفات" : "جاري تجهيز المهمة"}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>

                  {jobStatus && (
                    <>
                      <div className="flex items-center justify-between text-sm text-gray-300">
                        <span>الحالة: {statusToArabic(jobStatus)}</span>
                        <span>{jobProgress}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${jobProgress}%` }} />
                      </div>
                    </>
                  )}

                  {jobId && <p className="text-xs text-gray-500">Job ID: {jobId}</p>}
                </div>
              )}

              {/* Stats bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-5 py-3">
                 <div className="flex items-center gap-4 text-sm text-gray-400">
                   <span className="flex items-center gap-1.5">
                     <FileText className="h-4 w-4" />
                     {images.length} صورة
                   </span>
                   <span>{sizeText}</span>
                 </div>
                <button
                  onClick={handleReset}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  حذف الكل
                </button>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="mb-2 text-sm text-gray-300">جودة PDF</p>
                <div className="flex gap-2">
                  {(["low", "medium", "high"] as PdfQuality[]).map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={isBusy}
                      onClick={() => setQuality(q)}
                      className={`rounded-lg px-3 py-1.5 text-sm transition ${
                        quality === q ? "bg-blue-500 text-white" : "bg-white/5 text-gray-300 hover:bg-white/10"
                      } disabled:opacity-50`}
                    >
                      {q === "low" ? "منخفض" : q === "medium" ? "متوسط" : "عالي"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Images grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {images.map((img, index) => (
                  <ImagePreviewCard
                    key={img.id}
                    file={img.file}
                    preview={img.preview}
                    index={index}
                    total={images.length}
                    onRemove={removeImage}
                    onMoveUp={moveUp}
                    onMoveDown={moveDown}
                  />
                ))}
              </div>

              {/* Convert button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
            <Button
                  onClick={handleConvert}
                  size="lg"
                  disabled={isBusy}
                  className="flex-1"
                >
                   {status === "converting" ? (
                     <>
                       <Loader2 className="h-5 w-5 animate-spin" />
                        {USE_SERVER_FLOW ? "جارٍ تنفيذ المهمة على السيرفر..." : "جارٍ تحويل الصور إلى PDF..."}
                      </>
                   ) : status === "success" ? (
                     <>
                       <Download className="h-5 w-5" />
                       تم إنشاء ملف PDF بنجاح
                     </>
                   ) : (
                     <>
                       <FileText className="h-5 w-5" />
                       تحويل إلى PDF
                     </>
                   )}
                </Button>

                {status === "success" && (
                  <>
                    {USE_SERVER_FLOW && downloadUrl && (
                      <Button href={downloadUrl}>
                        <Download className="h-5 w-5" />
                        تنزيل الملف
                      </Button>
                    )}
                    <Button onClick={handleReset} variant="secondary">
                      <RotateCcw className="h-5 w-5" />
                      تحويل مرة أخرى
                    </Button>
                  </>
                )}
              </div>

              {/* Status message */}
              {statusMessage && status !== "converting" && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`text-sm text-center ${
                    status === "success" ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {statusMessage}
                </motion.p>
              )}

              {report && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-gray-300 space-y-1">
                  <p>الحجم الأصلي: {formatSize(report.originalSize)}</p>
                  <p>حجم الناتج: {formatSize(report.outputSize)}</p>
                  <p>نسبة التغيير: {report.savingsPercentage.toFixed(2)}%</p>
                  {inputFileNames.length > 0 && <p>الملفات: {inputFileNames.join("، ")}</p>}
                  {report.outputSize > report.originalSize && (
                    <p className="text-amber-300">الناتج أكبر من الأصل بسبب نوع الملف/الجودة</p>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToolLayout>
  );
}
