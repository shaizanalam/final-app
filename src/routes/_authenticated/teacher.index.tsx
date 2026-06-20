import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { BookOpen, ClipboardList, CalendarCheck, Users, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher/")({
  component: TeacherDashboard,
});

function TeacherDashboard() {
  const { data: session } = useSession();
  const userId = session?.userId;

  const { data: assignments } = useQuery({
    queryKey: ["my-assignments", userId],
    queryFn: async () =>
      (await supabase
        .from("teacher_assignments")
        .select("id, class_id, stream_id, subject_id, classes(name), streams(name), subjects(name)")
        .eq("teacher_id", userId!)).data ?? [],
    enabled: !!userId,
  });

  const { data: counts } = useQuery({
    queryKey: ["teacher-counts", userId],
    queryFn: async () => {
      const [m, t] = await Promise.all([
        supabase.from("materials").select("*", { count: "exact", head: true }).eq("uploaded_by", userId!),
        supabase.from("tests").select("*", { count: "exact", head: true }).eq("created_by", userId!),
      ]);
      return { materials: m.count ?? 0, tests: t.count ?? 0 };
    },
    enabled: !!userId,
  });

  const { data: recentMaterials } = useQuery({
    queryKey: ["teacher-recent-materials", userId],
    queryFn: async () =>
      (await supabase
        .from("materials")
        .select("id,title,type,created_at")
        .eq("uploaded_by", userId!)
        .order("created_at", { ascending: false })
        .limit(5)).data ?? [],
    enabled: !!userId,
  });

  const { data: upcomingTests } = useQuery({
    queryKey: ["teacher-recent-tests", userId],
    queryFn: async () =>
      (await supabase
        .from("tests")
        .select("id,title,type,duration_minutes,published_at,total_marks")
        .eq("created_by", userId!)
        .order("created_at", { ascending: false })
        .limit(5)).data ?? [],
    enabled: !!userId,
  });

  const classCount = new Set((assignments ?? []).map((a) => a.class_id)).size;
  const subjectCount = new Set((assignments ?? []).map((a) => a.subject_id ?? a.id)).size;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={Users} label="Classes" value={classCount} />
        <Stat icon={BookOpen} label="Subjects" value={subjectCount} />
        <Stat icon={Upload} label="Materials" value={counts?.materials ?? 0} />
        <Stat icon={ClipboardList} label="Tests" value={counts?.tests ?? 0} />
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Link to="/teacher/materials" className="rounded-3xl bg-card border border-border p-5 shadow-soft hover:shadow-glow transition">
          <div className="size-11 rounded-2xl bg-primary/15 text-primary grid place-items-center"><Upload className="size-5" /></div>
          <p className="mt-3 font-bold">Upload material</p>
          <p className="text-xs text-muted-foreground">PDFs, worksheets, PPTs, question banks</p>
        </Link>
        <Link to="/teacher/tests" className="rounded-3xl bg-card border border-border p-5 shadow-soft hover:shadow-glow transition">
          <div className="size-11 rounded-2xl bg-accent/20 text-accent-foreground grid place-items-center"><ClipboardList className="size-5" /></div>
          <p className="mt-3 font-bold">Create test</p>
          <p className="text-xs text-muted-foreground">MCQ, multi, numeric, true/false</p>
        </Link>
        <Link to="/teacher/attendance" className="rounded-3xl bg-card border border-border p-5 shadow-soft hover:shadow-glow transition">
          <div className="size-11 rounded-2xl bg-info/15 text-info grid place-items-center"><CalendarCheck className="size-5" /></div>
          <p className="mt-3 font-bold">Mark attendance</p>
          <p className="text-xs text-muted-foreground">Daily roster, bulk-mark, history</p>
        </Link>
      </div>

      <div>
        <h2 className="font-bold text-lg">Your assignments</h2>
        <div className="mt-3 grid sm:grid-cols-2 gap-2">
          {(assignments ?? []).length === 0 && (
            <div className="sm:col-span-2 rounded-2xl border border-dashed p-6 text-center text-muted-foreground">
              No classes assigned yet. Ask your admin to assign you.
            </div>
          )}
          {(assignments ?? []).map((a) => {
            const row = a as { id: string; classes?: { name?: string } | null; streams?: { name?: string } | null; subjects?: { name?: string } | null };
            return (
              <div key={row.id} className="rounded-2xl bg-card border border-border p-4 shadow-soft">
                <p className="font-bold">{row.subjects?.name ?? "All subjects"}</p>
                <p className="text-sm text-muted-foreground">{row.classes?.name} {row.streams?.name ? `• ${row.streams.name}` : ""}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <h2 className="font-bold">Recent materials</h2>
          <div className="mt-3 space-y-2">
            {(recentMaterials ?? []).length === 0 && <Empty text="Nothing uploaded yet." />}
            {(recentMaterials ?? []).map((m) => (
              <div key={m.id} className="rounded-2xl bg-card border border-border p-3 shadow-soft">
                <p className="font-semibold">{m.title}</p>
                <p className="text-xs text-muted-foreground capitalize">{m.type.replace("_", " ")}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-bold">Recent tests</h2>
          <div className="mt-3 space-y-2">
            {(upcomingTests ?? []).length === 0 && <Empty text="No tests yet." />}
            {(upcomingTests ?? []).map((t) => (
              <Link key={t.id} to="/teacher/tests/$testId" params={{ testId: t.id }} className="block rounded-2xl bg-card border border-border p-3 shadow-soft hover:bg-secondary/40">
                <p className="font-semibold">{t.title}</p>
                <p className="text-xs text-muted-foreground capitalize">{t.type} • {t.duration_minutes} min • {t.published_at ? "Published" : "Draft"}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
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

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">{text}</div>;
}
