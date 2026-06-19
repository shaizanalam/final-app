import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "student" | "teacher" | "admin";
export type ProfileStatus = "pending" | "approved" | "blocked";

export interface SessionInfo {
  userId: string | null;
  email: string | null;
  profile: {
    id: string;
    name: string;
    email: string | null;
    mobile: string | null;
    status: ProfileStatus;
    avatar_url: string | null;
  } | null;
  roles: AppRole[];
  studentDetails: { class_id: string; stream_id: string | null } | null;
}

export async function fetchSession(): Promise<SessionInfo> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { userId: null, email: null, profile: null, roles: [], studentDetails: null };

  const [{ data: profile }, { data: roles }, { data: details }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("student_details").select("class_id, stream_id").eq("profile_id", user.id).maybeSingle(),
  ]);

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: profile as SessionInfo["profile"],
    roles: (roles ?? []).map((r) => r.role as AppRole),
    studentDetails: (details as SessionInfo["studentDetails"]) ?? null,
  };
}

export function useSession() {
  return useQuery({ queryKey: ["session"], queryFn: fetchSession, staleTime: 30_000 });
}

export function topRole(roles: AppRole[]): AppRole {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("teacher")) return "teacher";
  return "student";
}
