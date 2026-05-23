"use client";

import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import type { Tool } from "@/types";
import { ArrowRight, Construction } from "lucide-react";
import { getToolBySlug } from "@/lib/tools";

interface ToolPlaceholderProps {
  tool: Tool;
}

export default function ToolPlaceholder({ tool }: ToolPlaceholderProps) {
  const toolData = getToolBySlug(tool.slug);

  return (
    <div className="min-h-screen pt-24 pb-16 flex items-center justify-center">
      <Container>
        <div className="flex flex-col items-center text-center max-w-lg mx-auto">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500/10 to-blue-500/10 border border-primary-500/10">
            <Construction className="h-8 w-8 text-primary-400" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {toolData?.name || tool.name}
          </h1>

          <p className="text-gray-400 mb-8 leading-relaxed">
            {toolData?.description || tool.description}
          </p>

          <div className="glass rounded-2xl p-8 w-full mb-8">
            <p className="text-gray-500 text-sm">
              هذه الأداة قيد التطوير وستكون متاحة قريبًا.
            </p>
          </div>

          <Button href="/" variant="secondary">
            <ArrowRight className="h-5 w-5" />
            العودة إلى الرئيسية
          </Button>
        </div>
      </Container>
    </div>
  );
}
