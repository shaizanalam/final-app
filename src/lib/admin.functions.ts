import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string; email: string; password: string; mobile?: string }) => {
    if (!data?.email || !data?.password || !data?.name) throw new Error("Missing fields");
    if (data.password.length < 6) throw new Error("Password must be at least 6 characters");
    return data;
  })
  .handler(async ({ data, context }) => {
    // verify caller is admin
    const { data: isAdmin, error: rerr } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (rerr) throw new Error(rerr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name, mobile: data.mobile ?? null },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create user");

    // approve immediately
    await supabaseAdmin.from("profiles").update({ status: "approved" }).eq("id", created.user.id);
    // remove default 'student' role and add 'teacher'
    await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "teacher" });

    return { userId: created.user.id };
  });
