import type { Metadata } from "next";
import PdfToImagesClient from "./PdfToImagesClient";

export const metadata: Metadata = {
  title: "تحويل PDF إلى صور",
  description: "حوّل كل صفحات PDF إلى صور منفصلة داخل ملف ZIP بسهولة.",
  openGraph: {
    title: "تحويل PDF إلى صور | أدواتك",
    description: "ارفع ملف PDF وحمّل الصور الناتجة مباشرة بصيغة ZIP.",
  },
  alternates: {
    canonical: "/tools/pdf-to-images",
  },
};

export default function PdfToImagesPage() {
  return <PdfToImagesClient />;
}
