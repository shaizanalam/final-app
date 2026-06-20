import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, FileText, Trash2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher/materials")({
  component: TeacherMaterials,
});

const TYPES = ["pdf", "assignment", "question_bank", "worksheet", "ppt"] as const;
const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

function TeacherMaterials() {
  const { data: session } = useSession();
  const userId = session?.userId;
  const qc = useQueryClient();

  const { data: assignments } = useQuery({
    queryKey: ["my-assignments", userId],
    queryFn: async () =>
      (await supabase
        .from("teacher_assignments")
        .select("class_id, stream_id, subject_id, classes(name), streams(name), subjects(name, id)")
        .eq("teacher_id", userId!)).data ?? [],
    enabled: !!userId,
  });

  const subjects = useMemo(() => {
    const map = new Map<string, { id: string; label: string; class_id: string; stream_id: string | null }>();
    (assignments ?? []).forEach((a) => {
      const row = a as {
        class_id: string;
        stream_id: string | null;
        subject_id: string | null;
        classes?: { name?: string } | null;
        streams?: { name?: string } | null;
        subjects?: { name?: string; id?: string } | null;
      };
      if (row.subject_id && row.subjects?.id) {
        map.set(row.subjects.id, {
          id: row.subjects.id,
          label: `${row.subjects.name} — ${row.classes?.name}${row.streams?.name ? ` • ${row.streams.name}` : ""}`,
          class_id: row.class_id,
          stream_id: row.stream_id,
        });
      }
    });
    return [...map.values()];
  }, [assignments]);

  const [subjectId, setSubjectId] = useState<string>("");
  const [chapterId, setChapterId] = useState<string>("");
  const [newChapter, setNewChapter] = useState<string>("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<typeof TYPES[number]>("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const { data: chapters } = useQuery({
    queryKey: ["chapters", subjectId],
    queryFn: async () =>
      subjectId
        ? (await supabase.from("chapters").select("id,name").eq("subject_id", subjectId).order("display_order")).data ?? []
        : [],
    enabled: !!subjectId,
  });

  const { data: myMaterials } = useQuery({
    queryKey: ["my-materials", userId],
    queryFn: async () =>
      (await supabase
        .from("materials")
        .select("id,title,type,file_path,created_at,chapter_id,chapters(name, subjects(name))")
        .eq("uploaded_by", userId!)
        .order("created_at", { ascending: false })).data ?? [],
    enabled: !!userId,
  });

  async function ensureChapter(): Promise<string | null> {
    if (chapterId) return chapterId;
    if (!newChapter.trim() || !subjectId) return null;
    const { data, error } = await supabase
      .from("chapters")
      .insert({ subject_id: subjectId, name: newChapter.trim() })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    qc.invalidateQueries({ queryKey: ["chapters", subjectId] });
    return data.id;
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Pick a file");
    if (file.size > MAX_SIZE) return toast.error("File must be under 25 MB");
    if (!subjectId) return toast.error("Pick a subject");
    if (!title.trim()) return toast.error("Add a title");

    const chId = await ensureChapter();
    if (!chId) return toast.error("Pick or create a chapter");

    setUploading(true);
    setProgress(10);
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${subjectId}/${chId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await supabase.storage.from("materials").upload(path, file, { contentType: file.type });
    setProgress(70);
    if (up.error) {
      setUploading(false);
      setProgress(0);
      return toast.error(up.error.message);
    }
    const ins = await supabase.from("materials").insert({
      title: title.trim(),
      type,
      chapter_id: chId,
      file_path: path,
      uploaded_by: userId!,
    });
    setProgress(100);
    setUploading(false);
    if (ins.error) return toast.error(ins.error.message);
    toast.success("Material uploaded");
    setTitle("");
    setFile(null);
    setNewChapter("");
    setTimeout(() => setProgress(0), 700);
    qc.invalidateQueries({ queryKey: ["my-materials", userId] });
  }

  async function remove(m: { id: string; file_path: string }) {
    if (!confirm("Delete this material? Students will no longer see it.")) return;
    await supabase.storage.from("materials").remove([m.file_path]);
    const { error } = await supabase.from("materials").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["my-materials", userId] });
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <form onSubmit={handleUpload} className="rounded-3xl bg-card border border-border p-5 shadow-soft space-y-3">
        <h2 className="font-bold text-lg">Upload material</h2>
        <div>
          <Label>Subject (class + stream)</Label>
          <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setChapterId(""); }}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder={subjects.length ? "Select" : "No assigned subjects"} /></SelectTrigger>
            <SelectContent>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Chapter</Label>
          <div className="flex gap-2">
            <Select value={chapterId} onValueChange={setChapterId}>
              <SelectTrigger className="rounded-xl flex-1"><SelectValue placeholder={(chapters ?? []).length ? "Existing chapter" : "No chapters yet"} /></SelectTrigger>
              <SelectContent>
                {(chapters ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="…or type a new chapter name"
            value={newChapter}
            onChange={(e) => { setNewChapter(e.target.value); if (e.target.value) setChapterId(""); }}
            className="mt-2 rounded-xl"
            disabled={!subjectId}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof TYPES[number])}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" placeholder="Chapter 1 — Notes" maxLength={120} />
          </div>
        </div>
        <div>
          <Label>File (PDF, PPT, DOCX up to 25 MB)</Label>
          <Input type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="rounded-xl" />
        </div>
        {progress > 0 && <Progress value={progress} className="h-2" />}
        <Button disabled={uploading || !subjectId} className="w-full h-11 rounded-2xl">
          {uploading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Upload className="size-4 mr-2" />}
          Upload
        </Button>
      </form>

      <div>
        <h2 className="font-bold text-lg">Your uploads</h2>
        <div className="mt-3 space-y-2">
          {(myMaterials ?? []).length === 0 && (
            <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">Nothing uploaded yet.</div>
          )}
          {(myMaterials ?? []).map((m) => {
            const row = m as { id: string; title: string; type: string; file_path: string; chapters?: { name?: string; subjects?: { name?: string } | null } | null };
            return (
              <div key={row.id} className="rounded-2xl bg-card border border-border p-3 shadow-soft flex items-center gap-3">
                <div className="size-9 rounded-xl bg-primary/15 text-primary grid place-items-center"><FileText className="size-4" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{row.title}</p>
                  <p className="text-xs text-muted-foreground truncate capitalize">{row.type.replace("_", " ")} • {row.chapters?.subjects?.name} • {row.chapters?.name}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(row)} className="rounded-xl text-destructive hover:text-destructive">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
