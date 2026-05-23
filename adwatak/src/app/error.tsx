"use client";

import { AlertTriangle } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ reset }: ErrorProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="h-20 w-20 text-red-500/80 mb-6" />
      <h1 className="text-4xl font-bold text-white mb-4">حدث خطأ ما</h1>
      <p className="text-gray-400 mb-8 max-w-md">
        عذراً، حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-purple-600 to-blue-600 px-6 py-3 text-white font-medium hover:from-purple-500 hover:to-blue-500 transition-all duration-300"
      >
        حاول مرة أخرى
      </button>
    </div>
  );
}
