"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export interface ImageData {
  id: string;
  file: File;
  preview: string;
}

interface UseImageUploadOptions {
  maxFiles?: number;
  maxSize?: number;
}

export function useImageUpload(options: UseImageUploadOptions = {}) {
  const { maxFiles = 50, maxSize = 20 } = options;

  const [images, setImages] = useState<ImageData[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const revokeRef = useRef<string[]>([]);

  useEffect(() => {
    const currentRevoke = revokeRef.current;
    return () => {
      currentRevoke.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const createPreview = useCallback((file: File): string => {
    const url = URL.createObjectURL(file);
    revokeRef.current.push(url);
    return url;
  }, []);

  const revokePreviews = useCallback((previews: string[]) => {
    previews.forEach((url) => {
      const index = revokeRef.current.indexOf(url);
      if (index !== -1) {
        revokeRef.current.splice(index, 1);
      }
      URL.revokeObjectURL(url);
    });
  }, []);

  const addImages = useCallback(
    (files: File[]) => {
      const newErrors: string[] = [];

      const validFiles = files.filter((file) => {
        if (!file.type.startsWith("image/")) {
          newErrors.push(`"${file.name}" ليس صورة`);
          return false;
        }
        if (file.size > maxSize * 1024 * 1024) {
          newErrors.push(`"${file.name}" حجمه كبير (أكثر من ${maxSize}MB)`);
          return false;
        }
        return true;
      });

      const remaining = maxFiles - images.length;
      if (validFiles.length > remaining) {
        newErrors.push(
          `يمكنك إضافة ${maxFiles} صور كحد أقصى. تم تجاوز الحد بـ ${validFiles.length - remaining} صور.`
        );
      }

      const toAdd = validFiles.slice(0, Math.max(0, remaining));

      const newImages: ImageData[] = toAdd.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: createPreview(file),
      }));

      setImages((prev) => [...prev, ...newImages]);

      if (newErrors.length > 0) {
        setErrors((prev) => [...prev, ...newErrors]);
        // Errors are cleared manually or when new files are added
      }
     },
     [images, maxFiles, maxSize, createPreview]
   );

const removeImage = useCallback((index: number) => {
  setImages((prev) => {
    const removed = prev[index];
    if (removed?.preview) {
      revokePreviews([removed.preview]);
    }
    return prev.filter((_, i) => i !== index);
  });
}, [revokePreviews]);

  const moveImage = useCallback((fromIndex: number, toIndex: number) => {
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const moveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      moveImage(index, index - 1);
    },
    [moveImage]
  );

const moveDown = useCallback(
  (index: number) => {
    if (index >= images.length - 1) return;
    moveImage(index, index + 1);
  },
  [moveImage, images]
);

const clearAll = useCallback(() => {
  const previews = images.map((img) => img.preview);
  revokePreviews(previews);
  setImages([]);
  setErrors([]);
}, [images, revokePreviews]);

  const clearErrors = useCallback(() => setErrors([]), []);

  return {
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
  };
}
