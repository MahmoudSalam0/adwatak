import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "@/app/globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import BackgroundEffects from "@/components/background/BackgroundEffects";
import { getCurrentUser } from "@/lib/auth";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "أدواتك - كل أدواتك اليومية في مكان واحد",
    template: "%s | أدواتك",
  },
  description:
    "منصة مجانية تقدم أدوات احترافية لمعالجة الملفات والصور وبناء السيرة الذاتية. سريعة، آمنة، وبدون تحميل.",
  keywords: [
    "أدوات",
    "PDF",
    "صور",
    "CV",
    "سيرة ذاتية",
    "ضغط",
    "دمج",
    "تحويل",
    "مجاني",
    "عربي",
  ],
  openGraph: {
    title: "أدواتك - كل أدواتك اليومية في مكان واحد",
    description:
      "منصة مجانية تقدم أدوات احترافية لمعالجة الملفات والصور وبناء السيرة الذاتية.",
    type: "website",
    locale: "ar_SA",
    siteName: "أدواتك",
  },
  twitter: {
    card: "summary_large_image",
    title: "أدواتك - كل أدواتك اليومية في مكان واحد",
    description:
      "منصة مجانية تقدم أدوات احترافية لمعالجة الملفات والصور وبناء السيرة الذاتية.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${tajawal.variable} scroll-smooth`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-surface font-tajawal text-gray-100 antialiased">
        <BackgroundEffects />
        <Navbar initialEmail={user?.email ?? null} />
        <main className="relative">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
