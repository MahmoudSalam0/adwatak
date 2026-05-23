import type { ReactNode } from "react";

interface ToolModule {
  default: React.ComponentType;
}

const toolModules: Record<string, () => Promise<ToolModule>> = {
  // Each tool will be registered here as it's built:
  // "pdf-merge": () => import("@/tools/pdf-merge"),
  // "images-to-pdf": () => import("@/tools/images-to-pdf"),
  // "compress-pdf": () => import("@/tools/compress-pdf"),
  // "compress-image": () => import("@/tools/compress-image"),
  // "webp-to-jpg": () => import("@/tools/webp-to-jpg"),
  // "cv-builder": () => import("@/tools/cv-builder"),
};

export function getToolComponent(slug: string): (() => Promise<ToolModule>) | undefined {
  return toolModules[slug];
}

export function isToolAvailable(slug: string): boolean {
  return slug in toolModules;
}
