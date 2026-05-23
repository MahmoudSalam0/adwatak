"use client";

import { memo, useCallback } from "react";
import { motion } from "framer-motion";
import { X, ChevronUp, ChevronDown, FileImage } from "lucide-react";

interface ImagePreviewCardProps {
  file: File;
  preview: string;
  index: number;
  total: number;
  onRemove: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function ImagePreviewCard({
  file,
  preview,
  index,
  total,
  onRemove,
  onMoveUp,
  onMoveDown,
}: ImagePreviewCardProps) {
  const handleRemove = useCallback(() => onRemove(index), [index, onRemove]);
  const handleMoveUp = useCallback(() => onMoveUp(index), [index, onMoveUp]);
  const handleMoveDown = useCallback(
    () => onMoveDown(index),
    [index, onMoveDown]
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.25 }}
      className="group relative flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.06]"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-200">
        {preview ? (
          <img
            src={preview}
            alt={file.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FileImage className="h-6 w-6 text-gray-600" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white truncate">{file.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{formatSize(file.size)}</p>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {total > 1 && (
          <>
            <button
              onClick={handleMoveUp}
              disabled={index === 0}
              className="rounded-lg p-1.5 text-gray-500 hover:text-white hover:bg-white/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              aria-label="تحريك لأعلى"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              onClick={handleMoveDown}
              disabled={index === total - 1}
              className="rounded-lg p-1.5 text-gray-500 hover:text-white hover:bg-white/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              aria-label="تحريك لأسفل"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </>
        )}
        <button
          onClick={handleRemove}
          className="rounded-lg p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
          aria-label="إزالة"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

export default memo(ImagePreviewCard);
