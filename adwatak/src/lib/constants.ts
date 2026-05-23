import type { NavLink } from "@/types";

export const SITE = {
  name: "أدواتك",
  tagline: "كل أدواتك اليومية في مكان واحد",
  description:
    "منصة مجانية تقدم أدوات احترافية لمعالجة الملفات والصور وبناء السيرة الذاتية. سريعة، آمنة، وبدون تحميل.",
  url: "https://adwatak.com",
};

export const NAV_LINKS: NavLink[] = [
  { label: "الرئيسية", href: "#hero" },
  { label: "الأدوات", href: "#tools" },
  { label: "المميزات", href: "#features" },
];
