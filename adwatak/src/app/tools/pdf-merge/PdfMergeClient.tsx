"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Download, FilePlus, FileText, Loader2, RotateCcw, Trash2 } from "lucide-react";
import FadeIn from "@/components/animations/FadeIn";
import DropZone from "@/components/tools/DropZone";
import ToolLayout from "@/components/tools/ToolLayout";
import Button from "@/components/ui/Button";
import { uploadWithProgress } from "@/lib/jobs/upload";

type JobStatus = "queued" | "processing" | "completed" | "failed";

interface PdfItem {
  id: string;
  file: File;
}

function statusToArabic(status: JobStatus): string {
  if (status === "queued") return "في الانتظار";
  if (status === "processing") return "جاري المعالجة";
  if (status === "completed") return "جاهز للتحميل";
  return "فشلت العملية";
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PdfMergeClient() {
  const [files, setFiles] = useState<PdfItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "converting" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const addFiles = useCallback((selectedFiles: File[]) => {
    const nextErrors: string[] = [];
    const valid = selectedFiles.filter((file) => {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        nextErrors.push(`"${file.name}" ليس ملف PDF`);
        return false;
      }
      return true;
    });

    const items = valid.map((file) => ({ id: crypto.randomUUID(), file }));
    setFiles((prev) => [...prev, ...items]);
    if (nextErrors.length > 0) setErrors((prev) => [...prev, ...nextErrors]);
  }, []);

  const moveUp = useCallback((index: number) => {
    if (index === 0) return;
    setFiles((prev) => {
      const next = [...prev];
      const [current] = next.splice(index, 1);
      next.splice(index - 1, 0, current);
      return next;
    });
  }, []);

  const moveDown = useCallback((index: number) => {
    setFiles((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      const [current] = next.splice(index, 1);
      next.splice(index + 1, 0, current);
      return next;
    });
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const reset = useCallback(() => {
    setFiles([]);
    setErrors([]);
    setStatus("idle");
    setStatusMessage("");
    setUploadProgress(0);
    setJobProgress(0);
    setJobStatus(null);
    setJobId(null);
    setDownloadUrl(null);
  }, []);

  const pollJobStatus = useCallback(async (id: string) => {
    while (true) {
      const response = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? "تعذر متابعة المهمة");

      const nextStatus = payload?.data?.job?.status as JobStatus;
      const nextProgress = payload?.data?.job?.progress as number;
      const errorMessage = payload?.data?.job?.error_message as string | null;

      setJobStatus(nextStatus);
      setJobProgress(nextProgress ?? 0);

      if (nextStatus === "completed") {
        const down = await fetch(`/api/jobs/${id}/download`, { cache: "no-store" });
        const downPayload = await down.json();
        if (!down.ok) throw new Error(downPayload?.error?.message ?? "تعذر إنشاء رابط التحميل");
        setDownloadUrl(downPayload?.data?.url ?? null);
        setStatus("success");
        setStatusMessage("تم دمج ملفات PDF بنجاح");
        return;
      }

      if (nextStatus === "failed") {
        setStatus("error");
        setStatusMessage(errorMessage ?? "فشلت عملية الدمج");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }, []);

  const handleMerge = useCallback(async () => {
    if (files.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setStatus("converting");
    setStatusMessage("جاري رفع الملفات...");
    setUploadProgress(0);
    setJobProgress(0);
    setJobStatus(null);
    setJobId(null);
    setDownloadUrl(null);

    try {
      const uploadReq = await fetch("/api/storage/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: files.map(({ file }) => ({ fileName: file.name, contentType: "application/pdf", sizeBytes: file.size })),
        }),
      });
      const uploadPayload = await uploadReq.json();
      if (!uploadReq.ok) throw new Error(uploadPayload?.error?.message ?? "تعذر إنشاء روابط الرفع");

      const uploads = uploadPayload?.data?.uploads as Array<{ path: string; signedUploadUrl: string }>;
      const totalBytes = files.reduce((acc, item) => acc + item.file.size, 0);
      let uploaded = 0;

      for (let i = 0; i < uploads.length; i++) {
        const currentFile = files[i].file;
        await uploadWithProgress(uploads[i].signedUploadUrl, currentFile, (progress) => {
          const loaded = Math.round((progress / 100) * currentFile.size);
          setUploadProgress(Math.min(100, Math.round(((uploaded + loaded) / totalBytes) * 100)));
        });
        uploaded += currentFile.size;
        setUploadProgress(Math.min(100, Math.round((uploaded / totalBytes) * 100)));
      }

      setStatusMessage("جاري تجهيز المهمة...");

      const jobReq = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolType: "pdf_merge",
          inputFiles: uploads.map((upload, index) => ({
            path: upload.path,
            mime: "application/pdf",
            sizeBytes: files[index].file.size,
            orderIndex: index,
          })),
          options: {},
        }),
      });

      const jobPayload = await jobReq.json();
      if (!jobReq.ok) throw new Error(jobPayload?.error?.message ?? "تعذر إنشاء المهمة");
      const id = jobPayload?.data?.job?.id as string;
      setJobId(id);
      setJobStatus("queued");

      const processRes = await fetch(`/api/jobs/${id}/process`, { method: "POST" });
      if (!processRes.ok) {
        const processPayload = await processRes.json();
        throw new Error(processPayload?.error?.message ?? "تعذر بدء المعالجة");
      }

      await pollJobStatus(id);
    } catch (error) {
      setStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "حدث خطأ أثناء الدمج");
    } finally {
      setIsSubmitting(false);
    }
  }, [files, isSubmitting, pollJobStatus]);

  const totalSize = files.reduce((acc, item) => acc + item.file.size, 0);

  return (
    <ToolLayout
      title="دمج ملفات PDF"
      description="ادمج عدة ملفات PDF في ملف واحد بنفس الترتيب الذي تختاره"
      icon={<FilePlus className="h-7 w-7 text-white" />}
      gradient="from-purple-500 to-violet-600"
    >
      <div className="space-y-6">
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
                  <p key={i} className="text-sm text-red-300">{err}</p>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <FadeIn>
          <DropZone
            onFilesSelected={addFiles}
            disabled={isSubmitting}
            accept="application/pdf,.pdf"
            fileTypesLabel="PDF"
            maxSize={15}
          />
        </FadeIn>

        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] px-5 py-3">
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  {files.length} ملف
                </span>
                <span>{formatSize(totalSize)}</span>
              </div>
              <button
                onClick={reset}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                حذف الكل
              </button>
            </div>

            <div className="space-y-2">
              {files.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3"
                >
                  <FileText className="h-5 w-5 text-purple-300" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{item.file.name}</p>
                    <p className="text-xs text-gray-500">{formatSize(item.file.size)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveUp(index)} disabled={index === 0 || isSubmitting} className="rounded px-2 py-1 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-40">↑</button>
                    <button onClick={() => moveDown(index)} disabled={index === files.length - 1 || isSubmitting} className="rounded px-2 py-1 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-40">↓</button>
                    <button onClick={() => removeFile(index)} disabled={isSubmitting} className="rounded px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40">حذف</button>
                  </div>
                </div>
              ))}
            </div>

            {status === "converting" && (
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

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Button onClick={handleMerge} size="lg" disabled={isSubmitting} className="flex-1">
                {status === "converting" ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    جارٍ دمج ملفات PDF...
                  </>
                ) : (
                  <>
                    <FilePlus className="h-5 w-5" />
                    دمج ملفات PDF
                  </>
                )}
              </Button>

              {status === "success" && downloadUrl && (
                <Button href={downloadUrl}>
                  <Download className="h-5 w-5" />
                  تنزيل الملف
                </Button>
              )}

              {status !== "converting" && status !== "idle" && (
                <Button onClick={reset} variant="secondary">
                  <RotateCcw className="h-5 w-5" />
                  إعادة
                </Button>
              )}
            </div>

            {statusMessage && status !== "converting" && (
              <p className={`text-sm text-center ${status === "success" ? "text-emerald-400" : "text-red-400"}`}>
                {statusMessage}
              </p>
            )}
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
