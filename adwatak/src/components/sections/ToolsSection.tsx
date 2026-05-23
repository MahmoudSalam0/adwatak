"use client";

import Container from "@/components/ui/Container";
import SectionTitle from "@/components/ui/SectionTitle";
import ToolCard from "@/components/ui/ToolCard";
import EmptyState from "@/components/ui/EmptyState";
import { tools } from "@/lib/tools";

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
            <ToolCard key={tool.slug} tool={tool} index={index} />
          ))}
        </div>
      </Container>
    </section>
  );
}
