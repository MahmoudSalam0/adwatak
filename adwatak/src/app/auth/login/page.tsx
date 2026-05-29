"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload?.error?.message ?? "تعذر تسجيل الدخول");
        return;
      }

      setMessage(payload?.data?.message ?? "تم إرسال الرابط");
    } catch {
      setError("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6">
        <h1 className="text-2xl font-bold text-white">تسجيل الدخول</h1>
        <p className="mt-2 text-sm text-gray-400">سنرسل لك رابط دخول آمن عبر البريد الإلكتروني.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <input
            type="email"
            required
            dir="ltr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none ring-primary-500/30 transition focus:ring"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-l from-purple-600 to-blue-600 px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? "جاري الإرسال..." : "إرسال رابط الدخول"}
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      </div>
    </div>
  );
}
