"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Tool } from "@/types";
import {
  FilePlus,
  ImageUp,
  FileDown,
  ImageDown,
  Repeat2,
  FileText,
  Images,
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  FilePlus,
  ImageUp,
  FileDown,
  ImageDown,
  Repeat2,
  FileText,
  Images,
};

interface ToolCardProps {
  tool: Tool;
  index: number;
}

export default function ToolCard({ tool, index }: ToolCardProps) {
  const Icon = iconMap[tool.icon] || FileText;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Link href={`/tools/${tool.slug}`}>
        <div
          className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 md:p-8 transition-all duration-500 hover:border-white/[0.12] hover:bg-white/[0.06]"
          style={{ "--tool-color": tool.color } as React.CSSProperties}
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{
              background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${tool.color}15, transparent 40%)`,
            }}
          />

          <div className="relative z-10">
            <div
              className={cn(
                "mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br",
                tool.gradient
              )}
            >
              <Icon className="h-6 w-6 text-white" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-transition">
              {tool.name}
            </h3>

            <p className="text-gray-400 text-sm leading-relaxed">
              {tool.description}
            </p>

            <div className="mt-4 flex items-center gap-2 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span
                className="transition-colors"
                style={{ color: tool.color }}
              >
                استخدم الأداة
              </span>
              <svg
                className="h-4 w-4 transition-transform group-hover:-translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 19l7-7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
