import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, ChevronRight, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/tests")({
  component: TestsPage,
});

const TYPES = ["practice", "weekly", "monthly", "scholarship"] as const;

function TestsPage() {
  const [type, setType] = useState<string>("practice");
  const { data: tests } = useQuery({
    queryKey: ["tests"],
    queryFn: async () => (await supabase.from("tests").select("*").not("published_at", "is", null).order("created_at", { ascending: false })).data ?? [],
  });
  const filtered = (tests ?? []).filter((t) => t.type === type);

  return (
    <div className="px-5 pt-6 max-w-md mx-auto">
      <h1 className="font-display text-2xl font-extrabold">Tests</h1>
      <p className="text-sm text-muted-foreground">Sharpen your skills. Track your growth.</p>

      <Tabs value={type} onValueChange={setType} className="mt-5">
        <TabsList className="grid grid-cols-4 rounded-2xl">
          {TYPES.map((t) => <TabsTrigger key={t} value={t} className="rounded-xl capitalize text-xs">{t}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="mt-5 space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-3xl border border-dashed p-8 text-center text-muted-foreground">
            <ClipboardList className="size-10 mx-auto mb-2 text-muted-foreground/50" />
            No {type} tests yet.
          </div>
        )}
        {filtered.map((t) => (
          <div key={t.id} className="rounded-2xl bg-card border border-border p-4 shadow-soft flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-primary/15 text-primary grid place-items-center font-extrabold">{t.total_marks || "—"}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{t.title}</p>
              <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="size-3" /> {t.duration_minutes} min</span>
                <span className="capitalize">{t.type}</span>
              </div>
            </div>
            <button className="rounded-xl bg-primary text-primary-foreground p-2 shadow-soft"><ChevronRight className="size-5" /></button>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
        💡 Test-taking interface (timed runs, all 4 question types, instant results + confetti) is wired to the schema and ready to be enabled once your teachers publish a test.
      </div>
    </div>
  );
}
