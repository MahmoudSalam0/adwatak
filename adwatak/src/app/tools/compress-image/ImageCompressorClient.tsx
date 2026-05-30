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
interface Item { id: string; file: File }
type PngMode = "auto" | "keep-png" | "to-webp" | "to-jpg";

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

export default function ImageCompressorClient() {
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
  const [quality, setQuality] = useState(75);
  const [force, setForce] = useState(false);
  const [pngMode, setPngMode] = useState<PngMode>("auto");
  const [report, setReport] = useState<JobReport | null>(null);

  const addFiles = useCallback((selected: File[]) => {
    const invalid: string[] = [];
    const valid = selected.filter((f) => {
      if (!f.type.startsWith("image/")) {
        invalid.push(`"${f.name}" ليس صورة`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid.map((file) => ({ id: crypto.randomUUID(), file }))]);
    if (invalid.length) setErrors((prev) => [...prev, ...invalid]);
  }, []);

  const reset = useCallback(() => {
    setFiles([]); setErrors([]); setStatus("idle"); setStatusMessage("");
    setUploadProgress(0); setJobProgress(0); setJobStatus(null); setJobId(null); setDownloadUrl(null);
    setReport(null);
  }, []);

  const poll = useCallback(async (id: string) => {
    while (true) {
      const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error?.message ?? "تعذر متابعة المهمة");
      const nextStatus = payload?.data?.job?.status as JobStatus;
      const nextProgress = payload?.data?.job?.progress as number;
      const err = payload?.data?.job?.error_message as string | null;
      const resultReport = (payload?.data?.job?.options as { resultReport?: JobReport } | undefined)?.resultReport;
      setJobStatus(nextStatus); setJobProgress(nextProgress ?? 0);
      if (resultReport) setReport(resultReport);
      if (nextStatus === "completed") {
        const down = await fetch(`/api/jobs/${id}/download`, { cache: "no-store" });
        const downPayload = await down.json();
        if (!down.ok) throw new Error(downPayload?.error?.message ?? "تعذر إنشاء رابط التحميل");
        setDownloadUrl(downPayload?.data?.url ?? null);
        setStatus("success"); setStatusMessage("تم ضغط الصور بنجاح"); return;
      }
      if (nextStatus === "failed") {
        setStatus("error"); setStatusMessage(err ?? "فشلت عملية الضغط"); return;
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
  }, []);

  const start = useCallback(async () => {
    if (!files.length || isSubmitting) return;
    setIsSubmitting(true); setStatus("converting"); setStatusMessage("جاري رفع الملفات...");
    setUploadProgress(0); setJobProgress(0); setJobStatus(null); setJobId(null); setDownloadUrl(null);
    setReport(null);
    try {
      const uploadReq = await fetch("/api/storage/upload-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: files.map(({ file }) => ({ fileName: file.name, contentType: file.type, sizeBytes: file.size })) }),
      });
      const uploadPayload = await uploadReq.json();
      if (!uploadReq.ok) throw new Error(uploadPayload?.error?.message ?? "تعذر إنشاء روابط الرفع");
      const uploads = uploadPayload?.data?.uploads as Array<{ path: string; signedUploadUrl: string }>;
      const total = files.reduce((a, b) => a + b.file.size, 0);
      let done = 0;
      for (let i = 0; i < uploads.length; i++) {
        const file = files[i].file;
        await uploadWithProgress(uploads[i].signedUploadUrl, file, (p) => {
          const loaded = Math.round((p / 100) * file.size);
          setUploadProgress(Math.min(100, Math.round(((done + loaded) / total) * 100)));
        });
        done += file.size;
      }
      setUploadProgress(100); setStatusMessage("جاري تجهيز المهمة...");

      const jobReq = await fetch("/api/jobs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolType: "image_compress",
          inputFiles: uploads.map((u, i) => ({ path: u.path, mime: files[i].file.type || "image/jpeg", sizeBytes: files[i].file.size, orderIndex: i })),
          options: { quality, force, pngMode },
        }),
      });
      const jobPayload = await jobReq.json();
      if (!jobReq.ok) throw new Error(jobPayload?.error?.message ?? "تعذر إنشاء المهمة");
      const id = jobPayload?.data?.job?.id as string;
      setJobId(id); setJobStatus("queued");

      const processReq = await fetch(`/api/jobs/${id}/process`, { method: "POST" });
      if (!processReq.ok) {
        const p = await processReq.json();
        throw new Error(p?.error?.message ?? "تعذر بدء المعالجة");
      }
      await poll(id);
    } catch (e) {
      setStatus("error"); setStatusMessage(e instanceof Error ? e.message : "حدث خطأ أثناء الضغط");
    } finally {
      setIsSubmitting(false);
    }
  }, [files, force, isSubmitting, pngMode, poll, quality]);

  return (
    <ToolLayout
      title="ضغط الصور"
      description="ارفع الصور واضغطها ثم حمّلها كملف ZIP واحد"
      icon={<FileImage className="h-7 w-7 text-white" />}
      gradient="from-emerald-500 to-green-600"
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
          <DropZone onFilesSelected={addFiles} disabled={isSubmitting} dropLabel="الصور" fileTypesLabel="JPG, PNG, WebP" maxSize={15} />
        </FadeIn>

        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-5 py-3">
              <span className="text-sm text-gray-400">{files.length} صورة</span>
              <button onClick={reset} disabled={isSubmitting} className="flex items-center gap-1 text-sm text-red-400 disabled:opacity-50"><Trash2 className="h-4 w-4" /> حذف الكل</button>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-3">
              <div>
                <p className="text-sm text-gray-300 mb-1">جودة الضغط (JPG/WebP)</p>
                <input
                  type="range"
                  min={60}
                  max={85}
                  value={quality}
                  disabled={isSubmitting}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-gray-400">{quality}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  ["auto", "PNG تلقائي"],
                  ["keep-png", "الإبقاء PNG"],
                  ["to-webp", "تحويل WebP"],
                  ["to-jpg", "تحويل JPG"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setPngMode(value)}
                    className={`rounded-lg px-3 py-1.5 text-sm ${pngMode === value ? "bg-emerald-500 text-white" : "bg-white/5 text-gray-300"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={force} disabled={isSubmitting} onChange={(e) => setForce(e.target.checked)} />
                تصدير حتى لو الناتج أكبر من الأصل
              </label>
            </div>

            {status === "converting" && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 space-y-3">
                <div className="flex items-center justify-between text-sm text-gray-300"><span>{uploadProgress < 100 ? "جاري رفع الملفات" : "جاري تجهيز المهمة"}</span><span>{uploadProgress}%</span></div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${uploadProgress}%` }} /></div>
                {jobStatus && <><div className="flex items-center justify-between text-sm text-gray-300"><span>الحالة: {statusToArabic(jobStatus)}</span><span>{jobProgress}%</span></div><div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${jobProgress}%` }} /></div></>}
                {jobId && <p className="text-xs text-gray-500">Job ID: {jobId}</p>}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={start} size="lg" disabled={isSubmitting} className="flex-1">
                {status === "converting" ? <><Loader2 className="h-5 w-5 animate-spin" /> جارٍ ضغط الصور...</> : <>ضغط الصور</>}
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
                {typeof report.skippedCount === "number" && <p>الملفات المتجاوزة: {report.skippedCount}</p>}
                {report.outputSize > report.originalSize && <p className="text-amber-300">الناتج أكبر من الأصل بسبب نوع الملف/الجودة</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
