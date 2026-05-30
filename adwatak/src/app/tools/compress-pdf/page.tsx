import type { Metadata } from "next";
import PdfCompressClient from "./PdfCompressClient";

export const metadata: Metadata = {
  title: "ضغط PDF",
  description: "اضغط ملفات PDF مع الحفاظ على جودة مقبولة وتقليل الحجم قدر الإمكان.",
  openGraph: {
    title: "ضغط PDF | أدواتك",
    description: "ارفع ملفات PDF واضغطها ثم حمّل الناتج بسهولة.",
  },
  alternates: {
    canonical: "/tools/compress-pdf",
  },
};

export default function CompressPdfPage() {
  return <PdfCompressClient />;
}
