"use client";

import { cn } from "@/lib/utils";
import FadeIn from "../animations/FadeIn";

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  className?: string;
  align?: "center" | "right";
}

export default function SectionTitle({
  title,
  subtitle,
  className,
  align = "center",
}: SectionTitleProps) {
  return (
    <FadeIn>
      <div
        className={cn(
          "mb-12 md:mb-16",
          align === "center" && "text-center",
          align === "right" && "text-right",
          className
        )}
      >
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
          {title}
        </h2>
        {subtitle && (
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
    </FadeIn>
  );
}
