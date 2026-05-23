"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Zap, Shield, Infinity } from "lucide-react";
import type { ReactNode } from "react";

const featureIconMap: Record<string, React.ElementType> = {
  Zap,
  Shield,
  Infinity,
};

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  index: number;
}

export default function FeatureCard({
  icon,
  title,
  description,
  index,
}: FeatureCardProps) {
  const Icon = featureIconMap[icon] || Zap;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
    >
      <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8 transition-all duration-500 hover:border-primary-500/20 hover:bg-white/[0.06]">
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-primary-500/[0.03] to-blue-500/[0.03]" />

        <div className="relative z-10">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500/10 to-blue-500/10 border border-primary-500/10">
            <Icon className="h-7 w-7 text-primary-400" />
          </div>

          <h3 className="text-xl font-bold text-white mb-3">{title}</h3>

          <p className="text-gray-400 leading-relaxed">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}
