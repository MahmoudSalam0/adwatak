import Link from "next/link";
import { SITE } from "@/lib/constants";
import { Sparkles } from "lucide-react";

export default function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 group"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 shadow-lg shadow-purple-500/25">
        <Sparkles className="h-5 w-5 text-white" />
      </div>
      <span className="text-xl font-bold text-white">{SITE.name}</span>
    </Link>
  );
}
