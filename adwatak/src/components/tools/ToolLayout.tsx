"use client";

import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import FadeIn from "@/components/animations/FadeIn";

interface ToolLayoutProps {
  title: string;
  description: string;
  icon: ReactNode;
  gradient?: string;
  children: ReactNode;
}

export default function ToolLayout({
  title,
  description,
  icon,
  gradient = "from-blue-500 to-indigo-600",
  children,
}: ToolLayoutProps) {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <Container>
        <FadeIn>
          <div className="mb-4">
            <Button href="/#tools" variant="ghost" size="sm">
              <ArrowRight className="h-4 w-4" />
              العودة إلى الأدوات
            </Button>
          </div>
        </FadeIn>

        <FadeIn delay={0.05}>
          <div className="flex items-center gap-4 mb-4">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient}`}
            >
              {icon}
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">
                {title}
              </h1>
              <p className="text-gray-400 mt-1">{description}</p>
            </div>
          </div>
        </FadeIn>

        <div className="mt-8">{children}</div>
      </Container>
    </div>
  );
}
