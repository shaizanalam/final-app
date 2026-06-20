import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useSession, topRole } from "@/hooks/use-auth";
import { SectionShell, type NavItem } from "@/components/section-nav";
import { LayoutDashboard, BookOpen, ClipboardList, CalendarCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher")({
  component: TeacherLayout,
});

const ITEMS: NavItem[] = [
  { to: "/teacher", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/teacher/materials", label: "Materials", icon: BookOpen },
  { to: "/teacher/tests", label: "Tests", icon: ClipboardList },
  { to: "/teacher/attendance", label: "Attendance", icon: CalendarCheck },
];

function TeacherLayout() {
  const { data: session, isLoading } = useSession();

  if (isLoading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!session?.userId) return <Navigate to="/auth" />;
  const role = topRole(session.roles);
  if (role === "admin") return <Navigate to="/admin" />;
  if (role === "student") return <Navigate to="/app" />;
  if (session.profile?.status !== "approved") return <Navigate to="/pending" />;

  return (
    <SectionShell title={session.profile?.name ?? "Teacher"} subtitle="Teacher console" items={ITEMS}>
      <Outlet />
    </SectionShell>
  );
}
