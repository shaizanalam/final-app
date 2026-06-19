import { createFileRoute, Link, Outlet, useLocation, useNavigate, Navigate } from "@tanstack/react-router";
import { useSession, topRole } from "@/hooks/use-auth";
import { Home, BookOpen, ClipboardList, BarChart3, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

const TABS: Array<{ to: "/app" | "/app/materials" | "/app/tests" | "/app/results" | "/app/profile"; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean }> = [
  { to: "/app", label: "Home", icon: Home, exact: true },
  { to: "/app/materials", label: "Materials", icon: BookOpen },
  { to: "/app/tests", label: "Tests", icon: ClipboardList },
  { to: "/app/results", label: "Results", icon: BarChart3 },
  { to: "/app/profile", label: "Profile", icon: User },
];

function AppLayout() {
  const { data, isLoading } = useSession();
  const loc = useLocation();
  const navigate = useNavigate();

  if (isLoading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!data?.userId) { navigate({ to: "/auth" }); return null; }
  if (data.profile?.status !== "approved") return <Navigate to="/pending" />;
  const role = topRole(data.roles);
  if (role === "admin") return <Navigate to="/admin" />;
  if (role === "teacher") return <Navigate to="/teacher" />;

  return (
    <div className="min-h-screen bg-background pb-24">
      <Outlet />
      <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur">
        <div className="max-w-md mx-auto grid grid-cols-5">
          {TABS.map((t) => {
            const active = t.exact ? loc.pathname === t.to : loc.pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-semibold transition ${active ? "text-primary" : "text-muted-foreground"}`}
              >
                <div className={`size-10 rounded-2xl grid place-items-center transition ${active ? "bg-primary/15" : ""}`}>
                  <t.icon className="size-5" />
                </div>
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
