"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Download, FileDown, FileText, Loader2, RotateCcw, Trash2 } from "lucide-react";
import FadeIn from "@/components/animations/FadeIn";
import DropZone from "@/components/tools/DropZone";
import ToolLayout from "@/components/tools/ToolLayout";
import Button from "@/components/ui/Button";
import { uploadWithProgress } from "@/lib/jobs/upload";

type JobStatus = "queued" | "processing" | "completed" | "failed";

interface Item { id: string; file: File }
interface JobReport {
  originalSize: number;
  outputSize: number;
  savingsPercentage: number;
  skippedCount?: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function statusToArabic(status: JobStatus): string {
  if (status === "queued") return "في الانتظار";
  if (status === "processing") return "جاري المعالجة";
  if (status === "completed") return "جاهز للتحميل";
  return "فشلت العملية";
}

export default function PdfCompressClient() {
  const [files, setFiles] = useState<Item[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "converting" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [report, setReport] = useState<JobReport | null>(null);

  const addFiles = useCallback((selected: File[]) => {
    const invalid: string[] = [];
    const valid = selected.filter((f) => {
      const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        invalid.push(`"${f.name}" ليس ملف PDF`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid.map((file) => ({ id: crypto.randomUUID(), file }))]);
    if (invalid.length) setErrors((prev) => [...prev, ...invalid]);
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
    setReport(null);
  }, []);

  const pollJobStatus = useCallback(async (id: string) => {
    while (true) {
      const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error?.message ?? "تعذر متابعة المهمة");

      const nextStatus = payload?.data?.job?.status as JobStatus;
      const nextProgress = payload?.data?.job?.progress as number;
      const errorMessage = payload?.data?.job?.error_message as string | null;
      const resultReport = (payload?.data?.job?.options as { resultReport?: JobReport } | undefined)?.resultReport;

      setJobStatus(nextStatus);
      setJobProgress(nextProgress ?? 0);
      if (resultReport) setReport(resultReport);

      if (nextStatus === "completed") {
        const hasDownload = (resultReport as { hasDownload?: boolean } | undefined)?.hasDownload !== false;
        if (hasDownload) {
          const down = await fetch(`/api/jobs/${id}/download`, { cache: "no-store" });
          const downPayload = await down.json();
          if (!down.ok) throw new Error(downPayload?.error?.message ?? "تعذر إنشاء رابط التحميل");
          setDownloadUrl(downPayload?.data?.url ?? null);
        } else {
          setDownloadUrl(null);
        }
        setStatus("success");
        const summary = (resultReport as { summaryMessage?: string } | undefined)?.summaryMessage;
        setStatusMessage(summary ?? "تم إنهاء معالجة ملفات PDF");
        return;
      }

      if (nextStatus === "failed") {
        setStatus("error");
        setStatusMessage(errorMessage ?? "فشلت عملية الضغط");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }, []);

  const handleCompress = useCallback(async () => {
    if (!files.length || isSubmitting) return;

    setIsSubmitting(true);
    setStatus("converting");
    setStatusMessage("جاري رفع الملفات...");
    setUploadProgress(0);
    setJobProgress(0);
    setJobStatus(null);
    setJobId(null);
    setDownloadUrl(null);
    setReport(null);

    try {
      const uploadReq = await fetch("/api/storage/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: files.map(({ file }) => ({ fileName: file.name, contentType: "application/pdf", sizeBytes: file.size })),
        }),
      });
      const uploadPayload = await uploadReq.json();
      if (!uploadReq.ok) {
        const details = uploadPayload?.error?.details;
        const detailText = typeof details === "string" ? details : details ? JSON.stringify(details) : "";
        throw new Error(
          `${uploadPayload?.error?.message ?? "تعذر إنشاء روابط الرفع"}${detailText ? ` - ${detailText}` : ""}`,
        );
      }

      const uploads = uploadPayload?.data?.uploads as Array<{ path: string; signedUploadUrl: string }>;
      const totalBytes = files.reduce((acc, item) => acc + item.file.size, 0);
      let uploaded = 0;

      for (let i = 0; i < uploads.length; i++) {
        const currentFile = files[i].file;
        try {
          await uploadWithProgress(uploads[i].signedUploadUrl, currentFile, (progress) => {
            const loaded = Math.round((progress / 100) * currentFile.size);
            setUploadProgress(Math.min(100, Math.round(((uploaded + loaded) / totalBytes) * 100)));
          });
        } catch (uploadError) {
          throw new Error(
            `فشل رفع الملف "${currentFile.name}": ${
              uploadError instanceof Error ? uploadError.message : "خطأ غير معروف"
            }`,
          );
        }
        uploaded += currentFile.size;
        setUploadProgress(Math.min(100, Math.round((uploaded / totalBytes) * 100)));
      }

      setStatusMessage("جاري تجهيز المهمة...");

      const jobReq = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolType: "pdf_compress",
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
      setStatusMessage(error instanceof Error ? error.message : "حدث خطأ أثناء الضغط");
    } finally {
      setIsSubmitting(false);
    }
  }, [files, isSubmitting, pollJobStatus]);

  const totalSize = files.reduce((acc, item) => acc + item.file.size, 0);

  return (
    <ToolLayout
      title="ضغط PDF"
      description="اضغط ملف PDF واحد أو أكثر مع الحفاظ على جودة مقبولة"
      icon={<FileDown className="h-7 w-7 text-white" />}
      gradient="from-cyan-500 to-teal-600"
    >
      <div className="space-y-6">
        <AnimatePresence>
          {errors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-red-500/20 bg-red-500/10 p-4"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div>{errors.map((e, i) => <p key={i} className="text-sm text-red-300">{e}</p>)}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <FadeIn>
          <DropZone
            onFilesSelected={addFiles}
            disabled={isSubmitting}
            accept="application/pdf,.pdf"
            dropLabel="ملفات PDF"
            fileTypesLabel="PDF"
            maxSize={15}
          />
        </FadeIn>

        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-5 py-3">
              <span className="text-sm text-gray-400">{files.length} ملف - {formatSize(totalSize)}</span>
              <button onClick={reset} disabled={isSubmitting} className="flex items-center gap-1 text-sm text-red-400 disabled:opacity-50"><Trash2 className="h-4 w-4" /> حذف الكل</button>
            </div>

            {status === "converting" && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 space-y-3">
                <div className="flex items-center justify-between text-sm text-gray-300"><span>{uploadProgress < 100 ? "جاري رفع الملفات" : "جاري تجهيز المهمة"}</span><span>{uploadProgress}%</span></div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${uploadProgress}%` }} /></div>
                {jobStatus && <><div className="flex items-center justify-between text-sm text-gray-300"><span>الحالة: {statusToArabic(jobStatus)}</span><span>{jobProgress}%</span></div><div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${jobProgress}%` }} /></div></>}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={handleCompress} size="lg" disabled={isSubmitting} className="flex-1">
                {status === "converting" ? <><Loader2 className="h-5 w-5 animate-spin" /> جارٍ ضغط PDF...</> : <>ضغط PDF</>}
              </Button>
              {status === "success" && downloadUrl && <Button href={downloadUrl}><Download className="h-5 w-5" /> تنزيل الملف</Button>}
              {status !== "idle" && status !== "converting" && <Button onClick={reset} variant="secondary"><RotateCcw className="h-5 w-5" /> إعادة</Button>}
            </div>

            {statusMessage && status !== "converting" && <p className={`text-sm text-center ${status === "success" ? "text-emerald-400" : "text-red-400"}`}>{statusMessage}</p>}

            {report && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-gray-300 space-y-1">
                <p>الحجم الأصلي: {formatSize(report.originalSize)}</p>
                <p>حجم الناتج: {formatSize(report.outputSize)}</p>
                <p>نسبة التغيير: {report.savingsPercentage.toFixed(2)}%</p>
                <p>عدد الملفات التي لم تتحسن: {report.skippedCount ?? 0}</p>
                {report.outputSize >= report.originalSize && <p className="text-amber-300">الناتج أكبر من الأصل بسبب نوع الملف/الجودة</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
