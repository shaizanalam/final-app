import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, CartesianGrid } from "recharts";
import { TrendingUp, Award } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/results")({
  component: ResultsPage,
});

function ResultsPage() {
  const { data: session } = useSession();
  const { data: attempts } = useQuery({
    queryKey: ["my-attempts", session?.userId],
    queryFn: async () => (await supabase.from("test_attempts").select("*, tests(title, subject_id, total_marks)").eq("student_id", session!.userId!).not("submitted_at", "is", null).order("submitted_at", { ascending: false })).data ?? [],
    enabled: !!session?.userId,
  });

  const trend = (attempts ?? []).slice(0, 10).reverse().map((a, i) => ({
    name: `T${i + 1}`,
    score: Number(a.score ?? 0),
  }));

  const subjectAgg: Record<string, { total: number; count: number }> = {};
  (attempts ?? []).forEach((a) => {
    const sid = (a as { tests?: { subject_id?: string } }).tests?.subject_id ?? "unknown";
    subjectAgg[sid] = subjectAgg[sid] ?? { total: 0, count: 0 };
    subjectAgg[sid].total += Number(a.score ?? 0);
    subjectAgg[sid].count += 1;
  });
  const subjectData = Object.entries(subjectAgg).map(([sid, v]) => ({ name: sid.slice(0, 6), avg: Math.round(v.total / v.count) }));

  return (
    <div className="px-5 pt-6 max-w-md mx-auto">
      <h1 className="font-display text-2xl font-extrabold">Your results</h1>
      <p className="text-sm text-muted-foreground">Every test is a step forward.</p>

      {(attempts ?? []).length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed p-10 text-center">
          <Award className="size-12 mx-auto text-accent-foreground/40" />
          <p className="mt-3 font-semibold">No results yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Attempt your first test to see your progress here.</p>
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-3xl bg-card border border-border p-4 shadow-soft">
            <div className="flex items-center gap-2"><TrendingUp className="size-4 text-primary" /><h2 className="font-bold">Growth trend</h2></div>
            <div className="h-40 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="oklch(0.72 0.19 145)" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 rounded-3xl bg-card border border-border p-4 shadow-soft">
            <h2 className="font-bold">Subject performance</h2>
            <div className="h-44 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectData}>
                  <CartesianGrid stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="avg" fill="oklch(0.78 0.17 60)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <h2 className="mt-6 font-bold">Recent attempts</h2>
          <div className="mt-3 space-y-2">
            {(attempts ?? []).map((a) => {
              const test = (a as { tests?: { title?: string; total_marks?: number } }).tests;
              return (
                <div key={a.id} className="rounded-2xl bg-card border border-border p-4 shadow-soft flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{test?.title ?? "Test"}</p>
                    <p className="text-xs text-muted-foreground">Accuracy {Math.round(Number(a.accuracy ?? 0))}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-extrabold text-primary">{a.score}<span className="text-sm text-muted-foreground">/{test?.total_marks ?? "—"}</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
