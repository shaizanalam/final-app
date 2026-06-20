import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher/tests/$testId")({
  component: TestEditor,
});

const QTYPES = ["mcq", "multi_correct", "numerical", "true_false"] as const;
type QType = typeof QTYPES[number];

function TestEditor() {
  const { testId } = Route.useParams();
  const qc = useQueryClient();

  const { data: test } = useQuery({
    queryKey: ["test", testId],
    queryFn: async () => (await supabase.from("tests").select("*").eq("id", testId).maybeSingle()).data,
  });

  const { data: questions } = useQuery({
    queryKey: ["questions", testId],
    queryFn: async () =>
      (await supabase
        .from("questions")
        .select("id, type, question_text, options, display_order, marks")
        .eq("test_id", testId)
        .order("display_order")).data ?? [],
  });

  const [draft, setDraft] = useState<{
    type: QType;
    question_text: string;
    options: string[];
    correct: string[]; // for mcq/multi: option indexes as strings; numerical: [value]; true_false: ["true"|"false"]
    marks: number;
  }>({ type: "mcq", question_text: "", options: ["", "", "", ""], correct: [], marks: 1 });

  async function addQuestion() {
    if (!draft.question_text.trim()) return toast.error("Question text required");
    type Insert = {
      type: QType;
      question_text: string;
      options: unknown;
      correct_answer: unknown;
      marks: number;
      test_id: string;
      display_order: number;
    };
    let payload: Insert = {
      type: draft.type,
      question_text: draft.question_text.trim(),
      options: null,
      correct_answer: null,
      marks: draft.marks,
      test_id: testId,
      display_order: (questions?.length ?? 0) + 1,
    };
    if (draft.type === "mcq") {
      if (draft.correct.length !== 1) return toast.error("Pick exactly one correct option");
      payload = { ...payload, options: draft.options, correct_answer: { value: Number(draft.correct[0]) } };
    } else if (draft.type === "multi_correct") {
      if (draft.correct.length === 0) return toast.error("Pick at least one correct option");
      payload = { ...payload, options: draft.options, correct_answer: { values: draft.correct.map(Number).sort((a, b) => a - b) } };
    } else if (draft.type === "numerical") {
      if (!draft.correct[0]) return toast.error("Enter the correct value");
      payload = { ...payload, options: null, correct_answer: { value: Number(draft.correct[0]) } };
    } else {
      if (!draft.correct[0]) return toast.error("Pick true or false");
      payload = { ...payload, options: null, correct_answer: { value: draft.correct[0] === "true" } };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("questions").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success("Question added");
    setDraft({ type: "mcq", question_text: "", options: ["", "", "", ""], correct: [], marks: 1 });
    qc.invalidateQueries({ queryKey: ["questions", testId] });
    qc.invalidateQueries({ queryKey: ["test", testId] });
  }

  async function reorder(id: string, dir: -1 | 1) {
    const list = [...(questions ?? [])];
    const idx = list.findIndex((q) => q.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= list.length) return;
    const a = list[idx], b = list[swap];
    await Promise.all([
      supabase.from("questions").update({ display_order: b.display_order }).eq("id", a.id),
      supabase.from("questions").update({ display_order: a.display_order }).eq("id", b.id),
    ]);
    qc.invalidateQueries({ queryKey: ["questions", testId] });
  }

  async function deleteQ(id: string) {
    if (!confirm("Delete this question?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["questions", testId] });
    qc.invalidateQueries({ queryKey: ["test", testId] });
  }

  async function updateMarks(id: string, marks: number) {
    await supabase.from("questions").update({ marks }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["questions", testId] });
    qc.invalidateQueries({ queryKey: ["test", testId] });
  }

  return (
    <div>
      <Link to="/teacher/tests" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="size-4" /> Back to tests
      </Link>
      <div className="rounded-2xl bg-card border border-border p-4 shadow-soft">
        <h2 className="font-bold text-lg">{test?.title ?? "Loading…"}</h2>
        <p className="text-sm text-muted-foreground capitalize">{test?.type} • {test?.duration_minutes} min • {test?.total_marks} marks • {test?.published_at ? "Published" : "Draft"}</p>
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        <div>
          <h3 className="font-bold">Questions ({questions?.length ?? 0})</h3>
          <div className="mt-3 space-y-2">
            {(questions ?? []).length === 0 && <p className="text-sm text-muted-foreground">No questions yet.</p>}
            {(questions ?? []).map((q, i) => {
              const opts = (q.options as string[] | null) ?? [];
              return (
                <div key={q.id} className="rounded-2xl bg-card border border-border p-3 shadow-soft">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Q{i + 1} • {q.type.replace("_", " ")}</p>
                      <p className="font-medium">{q.question_text}</p>
                      {opts.length > 0 && (
                        <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4">
                          {opts.map((o, idx) => <li key={idx}>{o}</li>)}
                        </ul>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Input type="number" min={1} defaultValue={q.marks} onBlur={(e) => updateMarks(q.id, Number(e.target.value))} className="h-8 w-16 rounded-lg text-center text-xs" />
                      <div className="flex gap-0.5">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => reorder(q.id, -1)}><ArrowUp className="size-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => reorder(q.id, 1)}><ArrowDown className="size-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteQ(q.id)}><Trash2 className="size-3" /></Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl bg-card border border-border p-5 shadow-soft">
          <h3 className="font-bold">Add a question</h3>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as QType, correct: [], options: v === "mcq" || v === "multi_correct" ? ["", "", "", ""] : [] })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">Single MCQ</SelectItem>
                    <SelectItem value="multi_correct">Multi-correct</SelectItem>
                    <SelectItem value="numerical">Numerical</SelectItem>
                    <SelectItem value="true_false">True / False</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Marks</Label>
                <Input type="number" min={1} value={draft.marks} onChange={(e) => setDraft({ ...draft, marks: Number(e.target.value) })} className="rounded-xl" />
              </div>
            </div>
            <div>
              <Label>Question</Label>
              <Textarea value={draft.question_text} onChange={(e) => setDraft({ ...draft, question_text: e.target.value })} className="rounded-xl" rows={3} maxLength={2000} />
            </div>

            {(draft.type === "mcq" || draft.type === "multi_correct") && (
              <div className="space-y-2">
                <Label>Options & correct answer</Label>
                {draft.options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {draft.type === "mcq" ? (
                      <RadioGroup value={draft.correct[0] ?? ""} onValueChange={(v) => setDraft({ ...draft, correct: [v] })} className="flex">
                        <RadioGroupItem value={String(i)} />
                      </RadioGroup>
                    ) : (
                      <Checkbox checked={draft.correct.includes(String(i))} onCheckedChange={(c) => {
                        const next = new Set(draft.correct);
                        if (c) next.add(String(i)); else next.delete(String(i));
                        setDraft({ ...draft, correct: [...next] });
                      }} />
                    )}
                    <Input value={o} onChange={(e) => {
                      const next = [...draft.options];
                      next[i] = e.target.value;
                      setDraft({ ...draft, options: next });
                    }} placeholder={`Option ${i + 1}`} className="rounded-xl" />
                  </div>
                ))}
              </div>
            )}

            {draft.type === "numerical" && (
              <div>
                <Label>Correct value</Label>
                <Input type="number" step="any" value={draft.correct[0] ?? ""} onChange={(e) => setDraft({ ...draft, correct: [e.target.value] })} className="rounded-xl" />
              </div>
            )}

            {draft.type === "true_false" && (
              <div>
                <Label>Correct answer</Label>
                <Select value={draft.correct[0] ?? ""} onValueChange={(v) => setDraft({ ...draft, correct: [v] })}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Pick" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">True</SelectItem>
                    <SelectItem value="false">False</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button onClick={addQuestion} className="w-full h-11 rounded-2xl"><Plus className="size-4 mr-1" /> Add question</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
