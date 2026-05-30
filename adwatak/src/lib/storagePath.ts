export function sanitizeStorageFileName(fileName: string): { safeBase: string; ext: string } {
  const trimmed = (fileName || "file").trim();
  const dotIndex = trimmed.lastIndexOf(".");

  const rawBase = dotIndex > 0 ? trimmed.slice(0, dotIndex) : trimmed;
  const rawExt = dotIndex > 0 ? trimmed.slice(dotIndex + 1) : "bin";

  const safeBase = rawBase
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "file";

  const ext = rawExt
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "bin";

  return { safeBase, ext };
}
