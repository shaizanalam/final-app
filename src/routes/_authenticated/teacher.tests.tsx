import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, BadgeCheck, FilePen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher/tests")({
  component: TeacherTests,
});

const TYPES = ["practice", "weekly", "monthly", "scholarship"] as const;

function TeacherTests() {
  const { data: session } = useSession();
  const userId = session?.userId;
  const qc = useQueryClient();

  const { data: assignments } = useQuery({
    queryKey: ["my-assignments", userId],
    queryFn: async () =>
      (await supabase
        .from("teacher_assignments")
        .select("subject_id, subjects(id,name,class_id,stream_id), classes(name), streams(name)")
        .eq("teacher_id", userId!)).data ?? [],
    enabled: !!userId,
  });

  const subjects = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    (assignments ?? []).forEach((a) => {
      const row = a as { subject_id: string | null; subjects?: { id?: string; name?: string } | null; classes?: { name?: string } | null; streams?: { name?: string } | null };
      if (row.subjects?.id) {
        map.set(row.subjects.id, {
          id: row.subjects.id,
          label: `${row.subjects.name} — ${row.classes?.name}${row.streams?.name ? ` • ${row.streams.name}` : ""}`,
        });
      }
    });
    return [...map.values()];
  }, [assignments]);

  const { data: tests } = useQuery({
    queryKey: ["my-tests", userId],
    queryFn: async () =>
      (await supabase
        .from("tests")
        .select("id,title,type,duration_minutes,total_marks,published_at,subject_id,subjects(name)")
        .eq("created_by", userId!)
        .order("created_at", { ascending: false })).data ?? [],
    enabled: !!userId,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "practice" as typeof TYPES[number], duration: 30, subjectId: "" });

  async function create() {
    if (!form.title.trim() || !form.subjectId) return toast.error("Title and subject required");
    const { data, error } = await supabase.from("tests").insert({
      title: form.title.trim(),
      type: form.type,
      duration_minutes: form.duration,
      subject_id: form.subjectId,
      created_by: userId!,
    }).select("id").single();
    if (error) return toast.error(error.message);
    toast.success("Test created — add questions");
    setOpen(false);
    setForm({ title: "", type: "practice", duration: 30, subjectId: "" });
    qc.invalidateQueries({ queryKey: ["my-tests", userId] });
    window.location.assign(`/teacher/tests/${data.id}`);
  }

  async function togglePublish(id: string, published: boolean) {
    const { error } = await supabase.from("tests").update({ published_at: published ? null : new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(published ? "Unpublished" : "Published");
    qc.invalidateQueries({ queryKey: ["my-tests", userId] });
  }

  async function remove(id: string) {
    if (!confirm("Delete this test and all its questions?")) return;
    await supabase.from("questions").delete().eq("test_id", id);
    const { error } = await supabase.from("tests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["my-tests", userId] });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">Tests</h2>
          <p className="text-sm text-muted-foreground">Build and publish tests for your students.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl"><Plus className="size-4 mr-1" /> New test</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create test</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl" maxLength={120} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as typeof TYPES[number] })}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Duration (min)</Label>
                  <Input type="number" min={1} max={300} value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} className="rounded-xl" />
                </div>
              </div>
              <div>
                <Label>Subject</Label>
                <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder={subjects.length ? "Pick subject" : "No assigned subjects"} /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={create} className="w-full h-11 rounded-2xl">Create & add questions</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        {(tests ?? []).length === 0 && (
          <div className="sm:col-span-2 rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            <FilePen className="size-10 mx-auto mb-2 text-muted-foreground/50" /> No tests yet.
          </div>
        )}
        {(tests ?? []).map((t) => {
          const row = t as { id: string; title: string; type: string; duration_minutes: number; total_marks: number; published_at: string | null; subjects?: { name?: string } | null };
          return (
            <div key={row.id} className="rounded-2xl bg-card border border-border p-4 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold truncate">{row.title}</p>
                  <p className="text-xs text-muted-foreground capitalize">{row.subjects?.name} • {row.type} • {row.duration_minutes} min • {row.total_marks} marks</p>
                </div>
                {row.published_at ? (
                  <span className="text-[10px] font-bold rounded-full bg-primary/15 text-primary px-2 py-1 flex items-center gap-1"><BadgeCheck className="size-3" /> LIVE</span>
                ) : (
                  <span className="text-[10px] font-bold rounded-full bg-secondary text-secondary-foreground px-2 py-1">DRAFT</span>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <Link to="/teacher/tests/$testId" params={{ testId: row.id }} className="flex-1">
                  <Button variant="outline" className="w-full rounded-xl h-9"><Pencil className="size-4 mr-1" /> Edit</Button>
                </Link>
                <Button variant="secondary" className="rounded-xl h-9" onClick={() => togglePublish(row.id, !!row.published_at)}>
                  {row.published_at ? "Unpublish" : "Publish"}
                </Button>
                <Button variant="ghost" className="rounded-xl h-9 text-destructive" onClick={() => remove(row.id)}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
