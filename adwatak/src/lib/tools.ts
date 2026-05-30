import type { Tool } from "@/types";

export interface ToolItem extends Tool {
  isReady: boolean;
}

export const tools: ToolItem[] = [
  {
    slug: "pdf-merge",
    name: "دمج PDF",
    description: "ادمج ملفات PDF متعددة في ملف واحد بسهولة ومجاناً",
    icon: "FilePlus",
    color: "#7c3aed",
    gradient: "from-purple-500 to-violet-600",
    isReady: true,
  },
  {
    slug: "jpg-to-pdf",
    name: "JPG إلى PDF",
    description: "حوّل صورك إلى مستند PDF احترافي في ثوانٍ",
    icon: "ImageUp",
    color: "#2563eb",
    gradient: "from-blue-500 to-indigo-600",
    isReady: true,
  },
  {
    slug: "compress-pdf",
    name: "ضغط PDF",
    description: "قلّص حجم ملفات PDF مع الحفاظ على الجودة العالية",
    icon: "FileDown",
    color: "#0891b2",
    gradient: "from-cyan-500 to-teal-600",
    isReady: false,
  },
  {
    slug: "compress-image",
    name: "ضغط الصور",
    description: "اضغط صورك لتقليل الحجم دون فقدان الجودة",
    icon: "ImageDown",
    color: "#059669",
    gradient: "from-emerald-500 to-green-600",
    isReady: true,
  },
  {
    slug: "webp-to-jpg",
    name: "تحويل WebP إلى JPG",
    description: "حوّل صور WebP إلى JPG بجودة عالية ومجاناً",
    icon: "Repeat2",
    color: "#d97706",
    gradient: "from-amber-500 to-orange-600",
    isReady: false,
  },
  {
    slug: "cv-builder",
    name: "بناء السيرة الذاتية",
    description: "أنشئ سيرتك الذاتية الاحترافية وصدّرها كملف PDF",
    icon: "FileText",
    color: "#dc2626",
    gradient: "from-red-500 to-rose-600",
    isReady: false,
  },
];

export function getToolBySlug(slug: string): ToolItem | undefined {
  return tools.find((tool) => tool.slug === slug);
}
