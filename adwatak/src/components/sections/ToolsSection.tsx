"use client";

import Container from "@/components/ui/Container";
import SectionTitle from "@/components/ui/SectionTitle";
import ToolCard from "@/components/ui/ToolCard";
import EmptyState from "@/components/ui/EmptyState";
import { tools } from "@/lib/tools";
import { cn } from "@/lib/utils";

export default function ToolsSection() {
  if (!tools || tools.length === 0) {
    return (
      <section id="tools" className="relative py-20 md:py-28">
        <Container>
          <SectionTitle
            title="أدواتك المتاحة"
            subtitle="اختر الأداة التي تناسبك"
          />
          <EmptyState />
        </Container>
      </section>
    );
  }

  return (
    <section id="tools" className="relative py-20 md:py-28">
      <Container>
        <SectionTitle
          title="أدواتك المتاحة"
          subtitle="اختر الأداة التي تناسبك وابدأ مباشرة"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {tools.map((tool, index) => (
            <div key={tool.slug} className="relative">
              {!tool.isReady && (
                <span className="absolute top-3 left-3 z-20 rounded-full border border-white/[0.08] bg-surface-100/80 px-2.5 py-1 text-xs font-medium text-gray-400 backdrop-blur-sm">
                  قريباً
                </span>
              )}
              <div
                className={cn(
                  !tool.isReady && "pointer-events-none opacity-50"
                )}
              >
                <ToolCard tool={tool} index={index} />
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
