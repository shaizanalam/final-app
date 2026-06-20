import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/subjects")({
  component: AdminSubjects,
});

function AdminSubjects() {
  const qc = useQueryClient();

  const { data: classes } = useQuery({
    queryKey: ["classes-all"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("display_order")).data ?? [],
  });
  const { data: streams } = useQuery({
    queryKey: ["streams-all"],
    queryFn: async () => (await supabase.from("streams").select("id,name")).data ?? [],
  });
  const { data: subjects } = useQuery({
    queryKey: ["subjects-admin"],
    queryFn: async () => (await supabase.from("subjects").select("*, classes(name), streams(name)").order("name")).data ?? [],
  });
  const { data: chapters } = useQuery({
    queryKey: ["chapters-admin"],
    queryFn: async () => (await supabase.from("chapters").select("id,name,subject_id,display_order").order("display_order")).data ?? [],
  });

  const [newSubject, setNewSubject] = useState({ name: "", classId: "", streamId: "" });
  async function addSubject() {
    if (!newSubject.name.trim() || !newSubject.classId) return toast.error("Name and class required");
    const { error } = await supabase.from("subjects").insert({
      name: newSubject.name.trim(),
      class_id: newSubject.classId,
      stream_id: newSubject.streamId || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Subject created");
    setNewSubject({ name: "", classId: "", streamId: "" });
    qc.invalidateQueries({ queryKey: ["subjects-admin"] });
  }

  async function delSubject(id: string) {
    if (!confirm("Delete subject and all its chapters/materials? This cannot be undone.")) return;
    await supabase.from("chapters").delete().eq("subject_id", id);
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["subjects-admin"] });
    qc.invalidateQueries({ queryKey: ["chapters-admin"] });
  }

  const [chapForSubject, setChapForSubject] = useState<string | null>(null);
  const [newChapter, setNewChapter] = useState("");
  async function addChapter() {
    if (!chapForSubject || !newChapter.trim()) return;
    const order = (chapters ?? []).filter((c) => c.subject_id === chapForSubject).length + 1;
    const { error } = await supabase.from("chapters").insert({ subject_id: chapForSubject, name: newChapter.trim(), display_order: order });
    if (error) return toast.error(error.message);
    setNewChapter("");
    qc.invalidateQueries({ queryKey: ["chapters-admin"] });
  }
  async function delChapter(id: string) {
    if (!confirm("Delete this chapter? Materials in it will be unlinked.")) return;
    await supabase.from("chapters").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["chapters-admin"] });
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div>
        <h2 className="font-bold text-lg">Subjects</h2>
        <div className="mt-3 rounded-3xl bg-card border border-border p-4 shadow-soft grid grid-cols-1 sm:grid-cols-4 gap-2">
          <Input placeholder="Subject name" value={newSubject.name} onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })} className="rounded-xl sm:col-span-2" />
          <Select value={newSubject.classId} onValueChange={(v) => setNewSubject({ ...newSubject, classId: v })}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Class" /></SelectTrigger>
            <SelectContent>{(classes ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={newSubject.streamId} onValueChange={(v) => setNewSubject({ ...newSubject, streamId: v })}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Stream (opt)" /></SelectTrigger>
            <SelectContent>{(streams ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={addSubject} className="sm:col-span-4 rounded-xl"><Plus className="size-4 mr-1" /> Add subject</Button>
        </div>

        <div className="mt-3 space-y-2">
          {(subjects ?? []).map((s) => {
            const row = s as { id: string; name: string; classes?: { name?: string } | null; streams?: { name?: string } | null };
            return (
              <div key={row.id} className="rounded-2xl bg-card border border-border p-3 shadow-soft flex items-center justify-between">
                <div>
                  <p className="font-bold">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.classes?.name} {row.streams?.name ? `• ${row.streams.name}` : ""}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="rounded-xl h-8" onClick={() => setChapForSubject(chapForSubject === row.id ? null : row.id)}>Chapters</Button>
                  <Button size="sm" variant="ghost" className="rounded-xl h-8 text-destructive" onClick={() => delSubject(row.id)}><Trash2 className="size-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="font-bold text-lg">Chapters {chapForSubject ? `— ${(subjects ?? []).find((s) => s.id === chapForSubject)?.name}` : ""}</h2>
        {!chapForSubject && <p className="mt-2 text-sm text-muted-foreground">Pick a subject on the left to manage its chapters.</p>}
        {chapForSubject && (
          <>
            <div className="mt-3 flex gap-2">
              <Input placeholder="New chapter name" value={newChapter} onChange={(e) => setNewChapter(e.target.value)} className="rounded-xl" />
              <Button onClick={addChapter} className="rounded-xl"><Plus className="size-4 mr-1" /> Add</Button>
            </div>
            <div className="mt-3 space-y-2">
              {(chapters ?? []).filter((c) => c.subject_id === chapForSubject).map((c) => (
                <div key={c.id} className="rounded-2xl bg-card border border-border p-3 shadow-soft flex items-center justify-between">
                  <p className="font-medium">{c.name}</p>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => delChapter(c.id)}><Trash2 className="size-3.5" /></Button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
