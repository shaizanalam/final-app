import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Bookmark, Clock, Flag, Loader2 } from "lucide-react";
import confetti from "canvas-confetti";

export const Route = createFileRoute("/_authenticated/app/tests/$testId")({
  component: TestRunner,
});

type StoredAnswer = unknown;
type LocalState = { startedAt: number; answers: Record<string, StoredAnswer>; flagged: string[]; attemptId: string };

function storageKey(testId: string, userId: string) {
  return `cci-attempt-${userId}-${testId}`;
}

function TestRunner() {
  const { testId } = Route.useParams();
  const { data: session } = useSession();
  const userId = session?.userId;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: test, isLoading: loadingTest } = useQuery({
    queryKey: ["test-run", testId],
    queryFn: async () => (await supabase.from("tests").select("*").eq("id", testId).maybeSingle()).data,
  });

  const { data: questions } = useQuery({
    queryKey: ["test-questions", testId],
    queryFn: async () =>
      (await supabase
        .from("questions")
        .select("id, type, question_text, options, display_order, marks")
        .eq("test_id", testId)
        .order("display_order")).data ?? [],
  });

  const [stage, setStage] = useState<"intro" | "running" | "submitting" | "result">("intro");
  const [state, setState] = useState<LocalState | null>(null);
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const submittedRef = useRef(false);

  // load any saved attempt
  useEffect(() => {
    if (!userId) return;
    const raw = localStorage.getItem(storageKey(testId, userId));
    if (raw) {
      try { setState(JSON.parse(raw) as LocalState); } catch { /* ignore */ }
    }
  }, [testId, userId]);

  // timer
  useEffect(() => {
    if (stage !== "running" || !state || !test) return;
    const total = test.duration_minutes * 60 * 1000;
    function tick() {
      const left = Math.max(0, total - (Date.now() - state!.startedAt));
      setRemaining(left);
      if (left <= 0 && !submittedRef.current) {
        submittedRef.current = true;
        void submit("auto");
      }
    }
    tick();
    const i = setInterval(tick, 500);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, state, test]);

  // persist state
  useEffect(() => {
    if (!state || !userId) return;
    localStorage.setItem(storageKey(testId, userId), JSON.stringify(state));
  }, [state, testId, userId]);

  const qList = questions ?? [];
  const total = qList.length;
  const answered = useMemo(() => state ? Object.keys(state.answers).length : 0, [state]);

  async function startAttempt() {
    if (!userId || !test) return;
    if (state?.attemptId) { setStage("running"); return; }
    const { data, error } = await supabase
      .from("test_attempts")
      .insert({ test_id: testId, student_id: userId, started_at: new Date().toISOString() })
      .select("id")
      .single();
    if (error || !data) return toast.error(error?.message ?? "Could not start");
    setState({ startedAt: Date.now(), answers: {}, flagged: [], attemptId: data.id });
    setStage("running");
  }

  function saveAnswer(qid: string, ans: StoredAnswer) {
    setState((prev) => prev ? { ...prev, answers: { ...prev.answers, [qid]: ans } } : prev);
  }
  function toggleFlag(qid: string) {
    setState((prev) => prev ? { ...prev, flagged: prev.flagged.includes(qid) ? prev.flagged.filter((x) => x !== qid) : [...prev.flagged, qid] } : prev);
  }

  async function submit(_kind: "manual" | "auto") {
    if (!state || !userId) return;
    setStage("submitting");
    // write answers
    const rows = Object.entries(state.answers).map(([question_id, student_answer]) => ({
      attempt_id: state.attemptId,
      question_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      student_answer: student_answer as any,
    }));
    if (rows.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from("test_answers").insert(rows as any);
    }
    // grade
    const { error } = await supabase.rpc("grade_attempt", { _attempt_id: state.attemptId });
    if (error) { toast.error(error.message); setStage("running"); return; }
    localStorage.removeItem(storageKey(testId, userId));
    qc.invalidateQueries({ queryKey: ["my-attempts", userId] });
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    setStage("result");
  }

  if (loadingTest) return <div className="px-5 pt-10 text-center text-muted-foreground">Loading…</div>;
  if (!test) return <div className="px-5 pt-10 text-center">Test not found.</div>;

  if (stage === "intro") {
    return (
      <div className="px-5 pt-6 max-w-md mx-auto">
        <Link to="/app/tests" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-4"><ArrowLeft className="size-4" /> Back</Link>
        <div className="rounded-3xl bg-hero p-6 text-white shadow-glow">
          <p className="text-xs opacity-90 uppercase font-bold">{test.type}</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold">{test.title}</h1>
          <div className="mt-3 flex items-center gap-3 text-sm opacity-95">
            <span className="flex items-center gap-1"><Clock className="size-4" /> {test.duration_minutes} min</span>
            <span>•</span>
            <span>{total} questions</span>
            <span>•</span>
            <span>{test.total_marks} marks</span>
          </div>
        </div>
        <div className="mt-5 rounded-3xl bg-card border border-border p-5 shadow-soft text-sm space-y-2">
          <p className="font-bold">Instructions</p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>Timer auto-submits when it reaches zero.</li>
            <li>Your answers save locally so a reload won't lose them.</li>
            <li>Use Flag to mark a question for review.</li>
            <li>Don't switch accounts during the test.</li>
          </ul>
        </div>
        <Button onClick={startAttempt} className="mt-6 w-full h-12 rounded-2xl text-base">
          {state?.attemptId ? "Resume test" : "Start test"}
        </Button>
      </div>
    );
  }

  if (stage === "submitting") {
    return <div className="min-h-[60vh] grid place-items-center text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>;
  }

  if (stage === "result") {
    return <ResultView attemptId={state!.attemptId} onClose={() => navigate({ to: "/app/results" })} />;
  }

  // running
  const q = qList[current];
  if (!q) return <div className="px-5 pt-10 text-center">No questions in this test yet.</div>;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const isFlagged = state?.flagged.includes(q.id) ?? false;
  const answer = state?.answers[q.id];

  return (
    <div className="px-5 pt-6 max-w-md mx-auto pb-32">
      <div className="rounded-2xl bg-card border border-border p-3 shadow-soft flex items-center justify-between">
        <div className="text-xs text-muted-foreground">Q{current + 1} of {total} • Answered {answered}</div>
        <div className={`flex items-center gap-1 text-sm font-bold ${mins < 1 ? "text-destructive" : "text-primary"}`}><Clock className="size-4" />{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</div>
      </div>

      <div className="mt-4 rounded-3xl bg-card border border-border p-5 shadow-soft">
        <p className="text-xs font-bold uppercase text-muted-foreground">{q.type.replace("_", " ")} • {q.marks} mark{q.marks > 1 ? "s" : ""}</p>
        <p className="mt-2 font-semibold">{q.question_text}</p>

        <div className="mt-4 space-y-2">
          {q.type === "mcq" && (
            <RadioGroup value={typeof (answer as { value?: number } | undefined)?.value === "number" ? String((answer as { value: number }).value) : ""} onValueChange={(v) => saveAnswer(q.id, { value: Number(v) })}>
              {((q.options as string[] | null) ?? []).map((o, i) => (
                <label key={i} className="flex items-center gap-3 rounded-2xl border border-border p-3 cursor-pointer hover:bg-secondary/40">
                  <RadioGroupItem value={String(i)} />
                  <span>{o}</span>
                </label>
              ))}
            </RadioGroup>
          )}
          {q.type === "multi_correct" && ((q.options as string[] | null) ?? []).map((o, i) => {
            const picked = (answer as { values?: number[] } | undefined)?.values ?? [];
            return (
              <label key={i} className="flex items-center gap-3 rounded-2xl border border-border p-3 cursor-pointer hover:bg-secondary/40">
                <Checkbox checked={picked.includes(i)} onCheckedChange={(c) => {
                  const set = new Set(picked);
                  if (c) set.add(i); else set.delete(i);
                  saveAnswer(q.id, { values: [...set].sort((a, b) => a - b) });
                }} />
                <span>{o}</span>
              </label>
            );
          })}
          {q.type === "numerical" && (
            <Input type="number" step="any" value={String((answer as { value?: number } | undefined)?.value ?? "")} onChange={(e) => saveAnswer(q.id, { value: Number(e.target.value) })} className="rounded-xl h-12" placeholder="Type your numeric answer" />
          )}
          {q.type === "true_false" && (
            <RadioGroup value={typeof (answer as { value?: boolean } | undefined)?.value === "boolean" ? String((answer as { value: boolean }).value) : ""} onValueChange={(v) => saveAnswer(q.id, { value: v === "true" })}>
              {[["true", "True"], ["false", "False"]].map(([v, l]) => (
                <label key={v} className="flex items-center gap-3 rounded-2xl border border-border p-3 cursor-pointer hover:bg-secondary/40">
                  <RadioGroupItem value={v} />
                  <span>{l}</span>
                </label>
              ))}
            </RadioGroup>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button variant="outline" disabled={current === 0} onClick={() => setCurrent((c) => Math.max(0, c - 1))} className="rounded-xl h-11"><ArrowLeft className="size-4 mr-1" /> Prev</Button>
        <Button variant={isFlagged ? "default" : "secondary"} onClick={() => toggleFlag(q.id)} className="rounded-xl h-11"><Flag className="size-4 mr-1" /> {isFlagged ? "Flagged" : "Flag"}</Button>
        <Button variant="outline" disabled={current === total - 1} onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))} className="rounded-xl h-11">Next <ArrowRight className="size-4 ml-1" /></Button>
      </div>

      <div className="mt-5 rounded-3xl bg-card border border-border p-3 shadow-soft">
        <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Question palette</p>
        <div className="grid grid-cols-6 gap-2">
          {qList.map((qq, i) => {
            const a = state?.answers[qq.id];
            const f = state?.flagged.includes(qq.id);
            return (
              <button key={qq.id} onClick={() => setCurrent(i)} className={`h-9 rounded-xl text-sm font-bold flex items-center justify-center relative ${i === current ? "ring-2 ring-primary" : ""} ${a ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                {i + 1}
                {f && <Bookmark className="size-3 absolute -top-1 -right-1 text-accent fill-accent" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 p-4 bg-background/95 backdrop-blur border-t border-border">
        <Button onClick={() => submit("manual")} className="w-full h-12 rounded-2xl max-w-md mx-auto block">Submit test</Button>
      </div>
    </div>
  );
}

function ResultView({ attemptId, onClose }: { attemptId: string; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["attempt-result", attemptId],
    queryFn: async () =>
      (await supabase
        .from("test_attempts")
        .select("score, accuracy, tests(title, total_marks)")
        .eq("id", attemptId)
        .maybeSingle()).data,
  });

  const score = Number(data?.score ?? 0);
  const total = Number((data as { tests?: { total_marks?: number } } | null | undefined)?.tests?.total_marks ?? 0);
  const acc = Math.round(Number(data?.accuracy ?? 0));
  const pct = total ? Math.round((score / total) * 100) : 0;

  return (
    <div className="px-5 pt-10 max-w-md mx-auto text-center">
      <div className="mx-auto rounded-3xl bg-hero p-8 text-white shadow-glow">
        <p className="text-sm opacity-90">Your score</p>
        <div className="mt-1 text-6xl font-extrabold">{score}<span className="text-2xl opacity-70">/{total || "—"}</span></div>
        <div className="mt-2 text-sm opacity-90">{pct}% • {acc}% accuracy</div>
      </div>
      <p className="mt-6 font-bold">{(data as { tests?: { title?: string } } | null | undefined)?.tests?.title}</p>
      <p className="text-sm text-muted-foreground">Great effort! Keep going.</p>
      <Button onClick={onClose} className="mt-6 w-full h-12 rounded-2xl">See all results</Button>
    </div>
  );
}
