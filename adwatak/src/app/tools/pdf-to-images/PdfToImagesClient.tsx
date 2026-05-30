"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Download, FileImage, Loader2, RotateCcw, Trash2 } from "lucide-react";
import FadeIn from "@/components/animations/FadeIn";
import DropZone from "@/components/tools/DropZone";
import ToolLayout from "@/components/tools/ToolLayout";
import Button from "@/components/ui/Button";
import { uploadWithProgress } from "@/lib/jobs/upload";

type JobStatus = "queued" | "processing" | "completed" | "failed";
type OutputFormat = "jpg" | "png";
type JpgQuality = "low" | "medium" | "high";

interface Item { id: string; file: File }

interface JobReport {
  originalSize: number;
  outputSize: number;
  pageCount: number;
  imageFormat: OutputFormat;
  quality: JpgQuality;
  averageImageSize?: number;
  note?: string;
}

interface JobOptionsPayload {
  resultReport?: JobReport;
  inputFileNames?: Array<string | null>;
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

export default function PdfToImagesClient() {
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
  const [format, setFormat] = useState<OutputFormat>("jpg");
  const [quality, setQuality] = useState<JpgQuality>("medium");
  const [report, setReport] = useState<JobReport | null>(null);
  const [inputFileNames, setInputFileNames] = useState<string[]>([]);

  const addFiles = useCallback((selected: File[]) => {
    const valid = selected.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (valid.length === 0) {
      setErrors(["يرجى اختيار ملف PDF صحيح"]);
      return;
    }
    setErrors([]);
    setFiles([{ id: crypto.randomUUID(), file: valid[0] }]);
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
    setInputFileNames([]);
  }, []);

  const poll = useCallback(async (id: string) => {
    while (true) {
      const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error?.message ?? "تعذر متابعة المهمة");

      const nextStatus = payload?.data?.job?.status as JobStatus;
      const nextProgress = payload?.data?.job?.progress as number;
      const err = payload?.data?.job?.error_message as string | null;
      const options = payload?.data?.job?.options as JobOptionsPayload | undefined;
      const resultReport = options?.resultReport;

      setJobStatus(nextStatus);
      setJobProgress(nextProgress ?? 0);
      if (resultReport) setReport(resultReport);
      setInputFileNames((options?.inputFileNames ?? []).filter((name): name is string => typeof name === "string" && name.length > 0));

      if (nextStatus === "completed") {
        const down = await fetch(`/api/jobs/${id}/download`, { cache: "no-store" });
        const downPayload = await down.json();
        if (!down.ok) throw new Error(downPayload?.error?.message ?? "تعذر إنشاء رابط التحميل");
        setDownloadUrl(downPayload?.data?.url ?? null);
        setStatus("success");
        setStatusMessage("تم تحويل PDF إلى صور بنجاح");
        return;
      }

      if (nextStatus === "failed") {
        setStatus("error");
        setStatusMessage(err ?? "فشلت عملية التحويل");
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }, []);

  const start = useCallback(async () => {
    if (!files.length || isSubmitting) return;
    setIsSubmitting(true);
    setStatus("converting");
    setStatusMessage("جاري رفع الملف...");
    setUploadProgress(0);
    setJobProgress(0);
    setJobStatus(null);
    setJobId(null);
    setDownloadUrl(null);
    setReport(null);
    setInputFileNames([]);

    try {
      const file = files[0].file;
      const uploadReq = await fetch("/api/storage/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [{ fileName: file.name, contentType: "application/pdf", sizeBytes: file.size }],
        }),
      });

      const uploadPayload = await uploadReq.json();
      if (!uploadReq.ok) throw new Error(uploadPayload?.error?.message ?? "تعذر إنشاء روابط الرفع");

      const uploads = uploadPayload?.data?.uploads as Array<{ path: string; signedUploadUrl: string }>;
      await uploadWithProgress(uploads[0].signedUploadUrl, file, (p) => setUploadProgress(Math.round(p)));
      setUploadProgress(100);
      setStatusMessage("جاري تجهيز المهمة...");

      const jobReq = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolType: "pdf_to_images",
          inputFiles: [{
            path: uploads[0].path,
            mime: "application/pdf",
            sizeBytes: file.size,
            orderIndex: 0,
            originalName: file.name,
          }],
          options: { format, quality },
        }),
      });

      const jobPayload = await jobReq.json();
      if (!jobReq.ok) throw new Error(jobPayload?.error?.message ?? "تعذر إنشاء المهمة");
      const id = jobPayload?.data?.job?.id as string;
      setJobId(id);
      setJobStatus("queued");

      const processReq = await fetch(`/api/jobs/${id}/process`, { method: "POST" });
      if (!processReq.ok) {
        const p = await processReq.json();
        throw new Error(p?.error?.message ?? "تعذر بدء المعالجة");
      }

      await poll(id);
    } catch (error) {
      setStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "حدث خطأ أثناء التحويل");
    } finally {
      setIsSubmitting(false);
    }
  }, [files, format, isSubmitting, poll, quality]);

  return (
    <ToolLayout
      title="تحويل PDF إلى صور"
      description="حوّل كل صفحات PDF إلى صور منفصلة داخل ملف ZIP"
      icon={<FileImage className="h-7 w-7 text-white" />}
      gradient="from-orange-500 to-amber-600"
    >
      <div className="space-y-6">
        <AnimatePresence>
          {errors.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
              <div className="flex items-start gap-3"><AlertCircle className="h-5 w-5 text-red-400" /><div>{errors.map((e, i) => <p key={i} className="text-sm text-red-300">{e}</p>)}</div></div>
            </motion.div>
          )}
        </AnimatePresence>

        <FadeIn>
          <DropZone onFilesSelected={addFiles} disabled={isSubmitting} accept="application/pdf,.pdf" dropLabel="ملف PDF" fileTypesLabel="PDF" maxSize={15} />
          <p className="mt-2 text-xs text-gray-400">اسحب وأفلت ملف PDF هنا</p>
        </FadeIn>

        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-5 py-3">
              <span className="text-sm text-gray-400">{files[0].file.name}</span>
              <button onClick={reset} disabled={isSubmitting} className="flex items-center gap-1 text-sm text-red-400 disabled:opacity-50"><Trash2 className="h-4 w-4" /> حذف</button>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-300">نوع الصورة:</span>
                {(["jpg", "png"] as OutputFormat[]).map((value) => (
                  <button key={value} type="button" disabled={isSubmitting} onClick={() => setFormat(value)} className={`rounded-lg px-3 py-1.5 text-sm ${format === value ? "bg-orange-500 text-white" : "bg-white/5 text-gray-300"}`}>{value.toUpperCase()}</button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-300">جودة JPG:</span>
                {(["low", "medium", "high"] as JpgQuality[]).map((value) => (
                  <button key={value} type="button" disabled={isSubmitting || format === "png"} onClick={() => setQuality(value)} className={`rounded-lg px-3 py-1.5 text-sm ${quality === value ? "bg-orange-500 text-white" : "bg-white/5 text-gray-300"} ${format === "png" ? "opacity-50" : ""}`}>{value === "low" ? "منخفض" : value === "medium" ? "متوسط" : "عالي"}</button>
                ))}
              </div>
            </div>

            {status === "converting" && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 space-y-3">
                <div className="flex items-center justify-between text-sm text-gray-300"><span>{uploadProgress < 100 ? "uploading" : "queued"}</span><span>{uploadProgress}%</span></div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${uploadProgress}%` }} /></div>
                {jobStatus && <><div className="flex items-center justify-between text-sm text-gray-300"><span>{statusToArabic(jobStatus)}</span><span>{jobProgress}%</span></div><div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${jobProgress}%` }} /></div></>}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={start} size="lg" disabled={isSubmitting} className="flex-1">
                {status === "converting" ? <><Loader2 className="h-5 w-5 animate-spin" /> جارٍ التحويل...</> : <>تحويل PDF إلى صور</>}
              </Button>
              {status === "success" && downloadUrl && <Button href={downloadUrl}><Download className="h-5 w-5" /> تنزيل الملف</Button>}
              {status !== "idle" && status !== "converting" && <Button onClick={reset} variant="secondary"><RotateCcw className="h-5 w-5" /> إعادة</Button>}
            </div>

            {statusMessage && status !== "converting" && <p className={`text-sm text-center ${status === "success" ? "text-emerald-400" : "text-red-400"}`}>{statusMessage}</p>}

            {report && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-gray-300 space-y-1">
                <p>الحجم الأصلي: {formatSize(report.originalSize)}</p>
                <p>حجم ZIP الناتج: {formatSize(report.outputSize)}</p>
                <p>عدد الصفحات: {report.pageCount}</p>
                <p>نوع الصور: {report.imageFormat.toUpperCase()}</p>
                <p>جودة الصور: {report.quality}</p>
                {typeof report.averageImageSize === "number" && <p>متوسط حجم الصورة: {formatSize(report.averageImageSize)}</p>}
                {inputFileNames.length > 0 && <p>الملف: {inputFileNames[0]}</p>}
                <p className="text-amber-300">قد يكون حجم الصور الناتجة أكبر من ملف PDF الأصلي حسب الجودة وعدد الصفحات.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
