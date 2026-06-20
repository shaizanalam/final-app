import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useSession, topRole } from "@/hooks/use-auth";
import { BrandLogo } from "@/components/brand";
import { BookOpen, GraduationCap, Sparkles, Trophy } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CCI LearnHub — Learn. Practice. Grow." },
      { name: "description", content: "Chhattisgarh Coaching Institute's all-in-one digital learning platform." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { data, isLoading } = useSession();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  if (data?.userId) {
    if (!data.profile) return <Navigate to="/auth" />;
    if (data.profile.status === "pending") return <Navigate to="/pending" />;
    if (data.profile.status === "blocked") return <Navigate to="/pending" />;
    const role = topRole(data.roles);
    if (role === "admin") return <Navigate to="/admin" />;
    if (role === "teacher") return <Navigate to="/teacher" />;
    return <Navigate to="/app" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <BrandLogo className="gap-3" />
        <Link to="/auth" className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90 transition">
          Sign in
        </Link>
      </header>

      <main className="px-5 max-w-6xl mx-auto pt-8 pb-20">
        <section className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-xs font-semibold text-secondary-foreground">
            <Sparkles className="size-3.5" /> Chhattisgarh Coaching Institute
          </div>
          <h1 className="mt-5 text-4xl sm:text-6xl font-extrabold tracking-tight">
            Learn. Practice. <span className="text-primary">Grow.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            All your materials, tests, attendance and results — in one fun, focused app built just for your class and stream.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth" className="rounded-2xl bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-glow hover:scale-[1.02] transition">
              Get started
            </Link>
            <Link to="/auth" className="rounded-2xl bg-accent px-6 py-3 text-base font-semibold text-accent-foreground shadow-soft">
              I'm a teacher
            </Link>
          </div>
        </section>

        <section className="mt-16 grid sm:grid-cols-3 gap-4">
          {[
            { icon: BookOpen, label: "Smart Materials", desc: "Class-specific PDFs, assignments, worksheets — always at your fingertips." , color: "bg-secondary text-secondary-foreground" },
            { icon: GraduationCap, label: "Real Tests", desc: "Timed practice, weekly, monthly & scholarship tests with instant results.", color: "bg-accent/20 text-accent-foreground" },
            { icon: Trophy, label: "Grow Daily", desc: "Track attendance, streaks, and subject-wise performance over time.", color: "bg-info/15 text-info" },
          ].map(({ icon: Icon, label, desc, color }) => (
            <div key={label} className="rounded-3xl bg-card p-6 shadow-soft border border-border">
              <div className={`size-12 rounded-2xl grid place-items-center ${color}`}><Icon className="size-6" /></div>
              <h3 className="mt-4 text-lg font-bold">{label}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
