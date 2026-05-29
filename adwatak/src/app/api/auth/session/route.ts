import { fail, ok } from "@/lib/api/responses";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return fail("تعذر قراءة الجلسة", 500, error.message);
  }

  if (!user) {
    return ok({ authenticated: false, user: null });
  }

  return ok({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email ?? null,
    },
  });
}
