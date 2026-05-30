import type { Metadata } from "next";
import ImageCompressorClient from "./ImageCompressorClient";

export const metadata: Metadata = {
  title: "ضغط الصور",
  description: "اضغط صور JPG و PNG لتقليل الحجم مع الحفاظ على جودة جيدة.",
  openGraph: {
    title: "ضغط الصور | أدواتك",
    description: "اضغط الصور وحمّلها كملف واحد بسهولة.",
  },
  alternates: {
    canonical: "/tools/compress-image",
  },
};

export default function CompressImagePage() {
  return <ImageCompressorClient />;
}
