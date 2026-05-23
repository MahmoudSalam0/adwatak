import type { Metadata } from "next";
import JpgToPdfClient from "./JpgToPdfClient";

export const metadata: Metadata = {
  title: "تحويل الصور إلى PDF",
  description:
    "حوّل صور JPG و PNG و WebP إلى مستند PDF احترافي. مجاني، سريع، وآمن تمامًا - بدون رفع ملفات للخادم.",
  openGraph: {
    title: "تحويل الصور إلى PDF | أدواتك",
    description:
      "حوّل صورك إلى مستند PDF احترافي في ثوانٍ. مجاني وسريع وآمن.",
  },
  alternates: {
    canonical: "/tools/jpg-to-pdf",
  },
};

export default function JpgToPdfPage() {
  return <JpgToPdfClient />;
}
