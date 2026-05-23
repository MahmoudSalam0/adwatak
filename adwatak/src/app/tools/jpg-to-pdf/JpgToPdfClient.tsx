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

  const handleConvert = useCallback(async () => {
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
  }, [images, setIsProcessing]);

  const handleReset = useCallback(() => {
    clearAll();
    setStatus("idle");
    setStatusMessage("");
  }, [clearAll]);

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
                  className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  حذف الكل
                </button>
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
                  disabled={isProcessing}
                  className="flex-1"
                >
                   {status === "converting" ? (
                     <>
                       <Loader2 className="h-5 w-5 animate-spin" />
                       جارٍ تحويل الصور إلى PDF...
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
                  <Button onClick={handleReset} variant="secondary">
                    <RotateCcw className="h-5 w-5" />
                    تحويل مرة أخرى
                  </Button>
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToolLayout>
  );
}
