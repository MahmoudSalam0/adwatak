import type { Metadata } from "next";
import PdfMergeClient from "./PdfMergeClient";

export const metadata: Metadata = {
  title: "دمج ملفات PDF",
  description: "ادمج عدة ملفات PDF في ملف واحد بالترتيب الذي تختاره. سريع وآمن.",
  openGraph: {
    title: "دمج ملفات PDF | أدواتك",
    description: "ادمج ملفات PDF متعددة في ملف واحد بسهولة.",
  },
  alternates: {
    canonical: "/tools/pdf-merge",
  },
};

export default function PdfMergePage() {
  return <PdfMergeClient />;
}
