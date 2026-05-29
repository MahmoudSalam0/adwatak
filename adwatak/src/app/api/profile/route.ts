import { z } from "zod";
import { fail, ok } from "@/lib/api/responses";
import { createClient } from "@/lib/supabase/server";

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  avatarUrl: z.string().trim().url().optional().or(z.literal("")),
});

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("غير مصرح", 401);
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("email, full_name, avatar_url")
    .eq("id", user.id)
    .single();

  if (error) {
    return fail("تعذر جلب الملف الشخصي", 500, error.message);
  }

  return ok({ profile: data });
}

export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail("غير مصرح", 401);
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(payload);
  if (!parsed.success) {
    return fail("البيانات غير صحيحة", 400, parsed.error.flatten());
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      avatar_url: parsed.data.avatarUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return fail("تعذر تحديث الملف الشخصي", 500, error.message);
  }

  return ok({ message: "تم تحديث الملف الشخصي" });
}
