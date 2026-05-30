#!/usr/bin/env node

function sanitizeStorageFileName(fileName) {
  const trimmed = (fileName || "file").trim();
  const dotIndex = trimmed.lastIndexOf(".");
  const rawBase = dotIndex > 0 ? trimmed.slice(0, dotIndex) : trimmed;
  const rawExt = dotIndex > 0 ? trimmed.slice(dotIndex + 1) : "bin";

  const safeBase =
    rawBase
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "file";

  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return { safeBase, ext };
}

const sample = "[Goodrich, Tamassia & Goldwasser 2014-01-28] - Copy ملف.pdf";
const result = sanitizeStorageFileName(sample);

if (!/^[a-z0-9_-]+$/.test(result.safeBase)) {
  throw new Error(`unsafe base: ${result.safeBase}`);
}

if (result.ext !== "pdf") {
  throw new Error(`unexpected ext: ${result.ext}`);
}

console.log("FILENAME TEST PASSED", result);
