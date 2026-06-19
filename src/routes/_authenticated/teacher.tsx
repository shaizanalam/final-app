import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useSession, topRole } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LogOut, Users, BookOpen, ClipboardList, CalendarCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher")({
  component: TeacherPage,
});

function TeacherPage() {
  const navigate = useNavigate();
  const { data: session, isLoading } = useSession();
  const { data: assignments } = useQuery({
    queryKey: ["my-assignments", session?.userId],
    queryFn: async () => (await supabase.from("teacher_assignments").select("*, classes(name), streams(name), subjects(name)").eq("teacher_id", session!.userId!)).data ?? [],
    enabled: !!session?.userId,
  });

  if (isLoading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!session?.userId) return <Navigate to="/auth" />;
  const role = topRole(session.roles);
  if (role === "admin") return <Navigate to="/admin" />;
  if (role === "student") return <Navigate to="/app" />;
  if (session.profile?.status !== "approved") return <Navigate to="/pending" />;

  async function signOut() { await supabase.auth.signOut(); navigate({ to: "/auth" }); }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-hero text-white px-6 py-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">Teacher</p>
            <h1 className="font-display text-2xl font-extrabold">{session.profile?.name}</h1>
          </div>
          <Button onClick={signOut} variant="secondary" size="sm" className="rounded-xl"><LogOut className="size-4 mr-1" /> Sign out</Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={BookOpen} label="Upload materials" desc="Add PDFs, worksheets, PPTs" />
          <StatCard icon={ClipboardList} label="Create test" desc="MCQ, multi, numeric, T/F" />
          <StatCard icon={CalendarCheck} label="Attendance" desc="Daily roster, bulk-mark" />
          <StatCard icon={Users} label="Performance" desc="Identify weak chapters" />
        </div>

        <h2 className="mt-8 font-bold text-lg">Your assignments</h2>
        <div className="mt-3 space-y-2">
          {(assignments ?? []).length === 0 && (
            <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">
              No classes assigned yet. Ask your admin to assign you.
            </div>
          )}
          {(assignments ?? []).map((a) => {
            const row = a as { id: string; classes?: { name?: string }; streams?: { name?: string }; subjects?: { name?: string } };
            return (
              <div key={row.id} className="rounded-2xl bg-card border border-border p-4 shadow-soft flex items-center justify-between">
                <div>
                  <p className="font-bold">{row.subjects?.name ?? "Subject"}</p>
                  <p className="text-sm text-muted-foreground">{row.classes?.name} {row.streams?.name ? `• ${row.streams.name}` : ""}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
          💡 Material upload, test builder, attendance roster and performance analytics are scaffolded on this dashboard and ready to flesh out in the next iteration.
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, desc }: { icon: React.ComponentType<{ className?: string }>; label: string; desc: string }) {
  return (
    <button className="rounded-3xl bg-card border border-border p-5 text-left shadow-soft hover:shadow-glow transition">
      <div className="size-11 rounded-2xl bg-primary/15 text-primary grid place-items-center"><Icon className="size-5" /></div>
      <p className="mt-3 font-bold">{label}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}
