"use client";

import { useEffect, useRef } from "react";

export default function BackgroundEffects() {
  const blobRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!blobRef.current) return;
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      blobRef.current.style.setProperty("--mouse-x", `${x}%`);
      blobRef.current.style.setProperty("--mouse-y", `${y}%`);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-surface" />

      <div
        ref={blobRef}
        className="absolute inset-0"
        style={
          {
            "--mouse-x": "50%",
            "--mouse-y": "50%",
          } as React.CSSProperties
        }
      >
        <div
          className="absolute -top-48 -right-48 h-[500px] w-[500px] animate-glow-pulse rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-48 -left-48 h-[500px] w-[500px] animate-glow-pulse rounded-full opacity-30"
          style={{
            animationDelay: "1.5s",
            background:
              "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] animate-glow-pulse rounded-full opacity-20"
          style={{
            animationDelay: "0.75s",
            background:
              "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)",
          }}
        />
      </div>

      <svg className="absolute inset-0 h-full w-full opacity-[0.03]">
        <defs>
          <pattern
            id="grid"
            width="64"
            height="64"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 64 0 L 0 0 0 64"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}
