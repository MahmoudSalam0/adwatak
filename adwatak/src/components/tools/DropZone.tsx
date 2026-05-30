"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileImage } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  accept?: string;
  maxSize?: number;
  fileTypesLabel?: string;
  dropLabel?: string;
}

const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/bmp";

export default function DropZone({
  onFilesSelected,
  disabled = false,
  accept = DEFAULT_ACCEPT,
  maxSize = 20,
  fileTypesLabel = "JPG, PNG, WebP",
  dropLabel = "الصور",
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      if (disabled) return;

      const valid: File[] = [];
      const allowed = accept.split(",");

      for (const file of Array.from(files)) {
        const ext = allowed.some((type) => {
          if (type.startsWith(".")) return file.name.toLowerCase().endsWith(type);
          return file.type.match(type.replace("*", ".*"));
        });

        if (!ext) continue;
        if (file.size > maxSize * 1024 * 1024) continue;

        valid.push(file);
      }

      if (valid.length > 0) {
        onFilesSelected(valid);
      }
    },
    [disabled, accept, maxSize, onFilesSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      disabled={disabled}
      className={cn(
        "relative w-full rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300",
        isDragging
          ? "border-primary-500 bg-primary-500/10 scale-[1.01]"
          : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="flex flex-col items-center gap-4">
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300",
            isDragging
              ? "bg-primary-500/20 scale-110"
              : "bg-white/[0.05]"
          )}
        >
          {isDragging ? (
            <FileImage className="h-8 w-8 text-primary-400" />
          ) : (
            <Upload className="h-8 w-8 text-gray-500" />
          )}
        </div>

        <div>
          <p className="text-lg font-medium text-white">
            {isDragging ? `أفلت ${dropLabel} هنا` : `اسحب وأفلت ${dropLabel} هنا`}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            أو انقر لاختيار الملفات
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-600">
          <span>{fileTypesLabel}</span>
          <span>حتى {maxSize} MB</span>
          <span>متعدد</span>
        </div>
      </div>
    </button>
  );
}
