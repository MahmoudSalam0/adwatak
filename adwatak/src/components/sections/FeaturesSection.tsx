"use client";

import Container from "@/components/ui/Container";
import SectionTitle from "@/components/ui/SectionTitle";
import FeatureCard from "@/components/ui/FeatureCard";
import type { Feature } from "@/types";

const features: Feature[] = [
  {
    icon: "Zap",
    title: "سريع وفوري",
    description:
      "جميع الأدوات تعمل مباشرة في متصفحك. لا حاجة للانتظار أو التحميل، النتائج فورية.",
  },
  {
    icon: "Shield",
    title: "آمن وخاص",
    description:
      "ملفاتك لا تُرفع إلى أي خادم. كل العمليات تتم محليًا على جهازك، خصوصيتك أولاً.",
  },
  {
    icon: "Infinity",
    title: "مجاني للأبد",
    description:
      "لا خطط مدفوعة ولا حدود استخدام. جميع الأدوات متاحة مجانًا بالكامل وبدون أي قيود.",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="relative py-20 md:py-28">
      <Container>
        <SectionTitle
          title="لماذا أدواتك؟"
          subtitle="منصة مصممة لتجربة سلسة وآمنة"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              index={index}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
