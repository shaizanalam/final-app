import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Bell, Calendar, BookOpen, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Home,
});

function Home() {
  const { data: session } = useSession();
  const name = session?.profile?.name?.split(" ")[0] ?? "Student";

  const { data: notices } = useQuery({
    queryKey: ["notices"],
    queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(5)).data ?? [],
  });

  const { data: upcomingTests } = useQuery({
    queryKey: ["upcoming-tests"],
    queryFn: async () => (await supabase.from("tests").select("*").not("published_at", "is", null).order("created_at", { ascending: false }).limit(4)).data ?? [],
  });

  const { data: recentMaterials } = useQuery({
    queryKey: ["recent-materials"],
    queryFn: async () => (await supabase.from("materials").select("*").order("created_at", { ascending: false }).limit(5)).data ?? [],
  });

  const { data: attendanceStats } = useQuery({
    queryKey: ["attendance-stats", session?.userId],
    queryFn: async () => {
      if (!session?.userId) return { pct: 0, total: 0, present: 0 };
      const { data } = await supabase.from("attendance").select("status").eq("student_id", session.userId);
      const total = data?.length ?? 0;
      const present = data?.filter((r) => r.status === "present").length ?? 0;
      return { pct: total ? Math.round((present / total) * 100) : 0, total, present };
    },
    enabled: !!session?.userId,
  });

  return (
    <div className="px-5 pt-6 max-w-md mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="font-display text-2xl font-extrabold">Hello, {name} 👋</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-2xl bg-streak/30 px-3 py-2 text-xs font-bold text-streak-foreground">
          <Flame className="size-4" /> 5 day streak
        </div>
      </header>

      {/* Attendance ring */}
      <section className="mt-5 rounded-3xl bg-hero p-5 text-white shadow-glow">
        <p className="text-sm opacity-90">Attendance this month</p>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="text-5xl font-extrabold leading-none">{attendanceStats?.pct ?? 0}<span className="text-2xl">%</span></div>
            <p className="mt-1 text-xs opacity-80">{attendanceStats?.present ?? 0} of {attendanceStats?.total ?? 0} days</p>
          </div>
          <Ring value={attendanceStats?.pct ?? 0} />
        </div>
      </section>

      {/* Notices */}
      <section className="mt-6">
        <SectionHead icon={Bell} title="Latest notices" />
        <div className="mt-3 space-y-2">
          {(notices ?? []).length === 0 && <EmptyCard text="No notices yet." />}
          {(notices ?? []).map((n) => (
            <div key={n.id} className="rounded-2xl bg-card border border-border p-4 shadow-soft">
              <p className="font-semibold">{n.title}</p>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{n.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Upcoming tests */}
      <section className="mt-6">
        <SectionHead icon={ClipboardList} title="Upcoming tests" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(upcomingTests ?? []).length === 0 && <div className="col-span-2"><EmptyCard text="No tests yet." /></div>}
          {(upcomingTests ?? []).map((t) => (
            <div key={t.id} className="rounded-2xl bg-secondary p-4">
              <div className="text-xs font-semibold uppercase text-secondary-foreground/70">{t.type}</div>
              <div className="mt-1 font-bold leading-tight">{t.title}</div>
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="size-3" /> {t.duration_minutes} min</div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent materials */}
      <section className="mt-6">
        <SectionHead icon={BookOpen} title="Recent materials" />
        <div className="mt-3 space-y-2">
          {(recentMaterials ?? []).length === 0 && <EmptyCard text="Your teachers haven't uploaded materials yet." />}
          {(recentMaterials ?? []).map((m) => (
            <div key={m.id} className="rounded-2xl bg-card border border-border p-4 shadow-soft flex items-center gap-3">
              <div className="size-10 rounded-xl bg-accent/20 grid place-items-center text-accent-foreground"><BookOpen className="size-5" /></div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{m.title}</p>
                <p className="text-xs text-muted-foreground capitalize">{m.type.replace("_", " ")}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionHead({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon className="size-4 text-primary" />
      <h2 className="font-bold text-base">{title}</h2>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{text}</div>;
}

function Ring({ value }: { value: number }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={r} stroke="rgba(255,255,255,0.25)" strokeWidth="8" fill="none" />
      <circle cx="40" cy="40" r={r} stroke="white" strokeWidth="8" fill="none"
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 40 40)" />
      <text x="40" y="46" textAnchor="middle" fontSize="18" fontWeight="800" fill="white">{value}%</text>
    </svg>
  );
}
