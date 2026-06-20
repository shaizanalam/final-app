import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useSession, topRole } from "@/hooks/use-auth";
import { SectionShell, type NavItem } from "@/components/section-nav";
import { Users, GraduationCap, BookOpen, Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const ITEMS: NavItem[] = [
  { to: "/admin", label: "Students", icon: Users, exact: true },
  { to: "/admin/teachers", label: "Teachers", icon: GraduationCap },
  { to: "/admin/subjects", label: "Subjects", icon: BookOpen },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
];

function AdminLayout() {
  const { data: session, isLoading } = useSession();

  if (isLoading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!session?.userId) return <Navigate to="/auth" />;
  if (!session.roles.includes("admin")) {
    const role = topRole(session.roles);
    return role === "teacher" ? <Navigate to="/teacher" /> : <Navigate to="/app" />;
  }
  return (
    <SectionShell title="LearnHub" subtitle="Admin console" items={ITEMS}>
      <Outlet />
    </SectionShell>
  );
}
