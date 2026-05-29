import { fail, ok } from "@/lib/api/responses";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!email) {
    return fail("البريد الإلكتروني مطلوب", 400);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${serverEnv.APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return fail("تعذر إرسال رابط تسجيل الدخول", 500, error.message);
  }

  return ok({ message: "تم إرسال رابط تسجيل الدخول إلى بريدك" });
}
