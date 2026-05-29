"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ProfileState {
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const res = await fetch("/api/profile", { cache: "no-store" });
      const payload = await res.json();

      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }

      if (!res.ok) {
        setError(payload?.error?.message ?? "تعذر تحميل الملف الشخصي");
        setLoading(false);
        return;
      }

      const profile = payload?.data?.profile as ProfileState;
      setEmail(profile.email ?? "");
      setFullName(profile.full_name ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
      setLoading(false);
    };

    void run();
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, avatarUrl }),
      });
      const payload = await res.json();

      if (!res.ok) {
        setError(payload?.error?.message ?? "تعذر حفظ الملف الشخصي");
        return;
      }

      setMessage("تم حفظ التغييرات بنجاح");
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen pt-28 pb-16 px-4">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-white/[0.04] p-6 md:p-8">
        <h1 className="text-2xl font-bold text-white">الملف الشخصي</h1>
        <p className="mt-2 text-sm text-gray-400">تحديث الاسم الكامل والصورة الشخصية.</p>

        {loading ? (
          <p className="mt-6 text-sm text-gray-400">جاري تحميل البيانات...</p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-sm text-gray-300">البريد الإلكتروني</label>
              <input
                value={email}
                disabled
                dir="ltr"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-gray-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-300">الاسم الكامل</label>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none ring-primary-500/30 focus:ring"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-300">رابط الصورة (اختياري)</label>
              <input
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                dir="ltr"
                placeholder="https://..."
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none ring-primary-500/30 focus:ring"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-l from-purple-600 to-blue-600 px-6 py-3 font-medium text-white disabled:opacity-60"
            >
              {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
            </button>
          </form>
        )}

        {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      </div>
    </div>
  );
}
