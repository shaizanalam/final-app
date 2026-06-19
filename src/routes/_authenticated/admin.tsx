import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useSession, topRole } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LogOut, UserCheck, UserX, Users, GraduationCap, BookOpen, Bell } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: session, isLoading } = useSession();

  const { data: students } = useQuery({
    queryKey: ["admin-students"],
    queryFn: async () => (await supabase
      .from("profiles")
      .select("*, student_details(class_id, stream_id, classes:classes(name), streams:streams(name))")
      .order("created_at", { ascending: false })).data ?? [],
    enabled: session?.roles.includes("admin"),
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [{ count: prof }, { count: tests }, { count: mats }, { count: att }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("tests").select("*", { count: "exact", head: true }),
        supabase.from("materials").select("*", { count: "exact", head: true }),
        supabase.from("attendance").select("*", { count: "exact", head: true }),
      ]);
      return { profiles: prof ?? 0, tests: tests ?? 0, materials: mats ?? 0, attendance: att ?? 0 };
    },
    enabled: session?.roles.includes("admin"),
  });

  if (isLoading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!session?.userId) return <Navigate to="/auth" />;
  if (!session.roles.includes("admin")) {
    const role = topRole(session.roles);
    return role === "teacher" ? <Navigate to="/teacher" /> : <Navigate to="/app" />;
  }

  async function setStatus(id: string, status: "approved" | "blocked" | "pending") {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    qc.invalidateQueries({ queryKey: ["admin-students"] });
  }

  async function signOut() { await supabase.auth.signOut(); navigate({ to: "/auth" }); }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-hero text-white px-6 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">Admin console</p>
            <h1 className="font-display text-2xl font-extrabold">CCI LearnHub</h1>
          </div>
          <Button onClick={signOut} variant="secondary" size="sm" className="rounded-xl"><LogOut className="size-4 mr-1" /> Sign out</Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat icon={Users} label="Users" value={stats?.profiles ?? 0} />
          <Stat icon={BookOpen} label="Materials" value={stats?.materials ?? 0} />
          <Stat icon={GraduationCap} label="Tests" value={stats?.tests ?? 0} />
          <Stat icon={Bell} label="Attendance entries" value={stats?.attendance ?? 0} />
        </div>

        <h2 className="mt-8 font-bold text-lg">Users — approvals</h2>
        <p className="text-sm text-muted-foreground">Approve, block or re-enable accounts.</p>

        <div className="mt-4 rounded-3xl bg-card border border-border shadow-soft overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-3 text-xs font-bold text-muted-foreground uppercase border-b border-border">
            <div className="col-span-4">Name</div>
            <div className="col-span-3">Class / Stream</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>
          {(students ?? []).map((s) => {
            const row = s as {
              id: string; name: string; email: string | null; status: string;
              student_details?: { classes?: { name?: string }; streams?: { name?: string } } | null;
            };
            const klass = row.student_details?.classes?.name;
            const stream = row.student_details?.streams?.name;
            return (
              <div key={row.id} className="grid grid-cols-12 px-4 py-3 items-center text-sm border-b border-border last:border-0">
                <div className="col-span-4">
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.email}</p>
                </div>
                <div className="col-span-3 text-muted-foreground">{klass ?? "—"} {stream ? `• ${stream}` : ""}</div>
                <div className="col-span-2">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full capitalize ${
                    row.status === "approved" ? "bg-primary/15 text-primary" :
                    row.status === "blocked" ? "bg-destructive/15 text-destructive" :
                    "bg-accent/20 text-accent-foreground"
                  }`}>{row.status}</span>
                </div>
                <div className="col-span-3 flex justify-end gap-2">
                  {row.status !== "approved" && (
                    <Button size="sm" className="rounded-xl h-8" onClick={() => setStatus(row.id, "approved")}>
                      <UserCheck className="size-3.5 mr-1" /> Approve
                    </Button>
                  )}
                  {row.status !== "blocked" && (
                    <Button size="sm" variant="outline" className="rounded-xl h-8" onClick={() => setStatus(row.id, "blocked")}>
                      <UserX className="size-3.5 mr-1" /> Block
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {(students ?? []).length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">No users yet.</div>}
        </div>

        <div className="mt-8 rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
          💡 Teacher creation, subject management, material oversight and notification composer are next on the build list — the schema and RLS are in place to power them.
        </div>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-card border border-border p-5 shadow-soft">
      <div className="size-10 rounded-2xl bg-primary/15 text-primary grid place-items-center"><Icon className="size-5" /></div>
      <p className="mt-3 text-2xl font-extrabold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
