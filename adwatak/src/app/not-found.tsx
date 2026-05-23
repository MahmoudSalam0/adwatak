import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <FileQuestion className="h-20 w-20 text-gray-600 mb-6" />
      <h1 className="text-4xl font-bold text-white mb-4">الصفحة غير موجودة</h1>
      <p className="text-gray-400 mb-8 max-w-md">
        عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-purple-600 to-blue-600 px-6 py-3 text-white font-medium hover:from-purple-500 hover:to-blue-500 transition-all duration-300"
      >
        العودة إلى الرئيسية
      </Link>
    </div>
  );
}
