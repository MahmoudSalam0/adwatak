export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center">
        <h1 className="text-2xl font-bold text-white">تعذر تسجيل الدخول</h1>
        <p className="mt-2 text-sm text-red-200">
          حدث خطأ أثناء التحقق من جلسة الدخول. يرجى المحاولة مرة أخرى.
        </p>
      </div>
    </div>
  );
}
