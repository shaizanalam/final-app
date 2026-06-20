import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, UserPlus, Link as LinkIcon } from "lucide-react";
import { createTeacher } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/teachers")({
  component: AdminTeachers,
});

function AdminTeachers() {
  const qc = useQueryClient();
  const createTeacherFn = useServerFn(createTeacher);

  const { data: teachers } = useQuery({
    queryKey: ["admin-teachers"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id,name,email,mobile,status").in("id", ids);
      return data ?? [];
    },
  });

  const { data: classes } = useQuery({
    queryKey: ["classes-all"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("display_order")).data ?? [],
  });
  const { data: streams } = useQuery({
    queryKey: ["streams-all"],
    queryFn: async () => (await supabase.from("streams").select("id,name")).data ?? [],
  });
  const { data: subjects } = useQuery({
    queryKey: ["subjects-all"],
    queryFn: async () => (await supabase.from("subjects").select("id,name,class_id,stream_id")).data ?? [],
  });
  const { data: assignments } = useQuery({
    queryKey: ["assignments-all"],
    queryFn: async () => (await supabase.from("teacher_assignments").select("*, classes(name), streams(name), subjects(name)")).data ?? [],
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", mobile: "" });
  const [busy, setBusy] = useState(false);

  async function submitCreate() {
    if (!form.name || !form.email || !form.password) return toast.error("Name, email and password required");
    setBusy(true);
    try {
      await createTeacherFn({ data: form });
      toast.success("Teacher created");
      setOpen(false);
      setForm({ name: "", email: "", password: "", mobile: "" });
      qc.invalidateQueries({ queryKey: ["admin-teachers"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const [assignFor, setAssignFor] = useState<string | null>(null);
  const teacherAssignments = useMemo(() => (assignments ?? []).filter((a) => a.teacher_id === assignFor), [assignments, assignFor]);

  const [aClass, setAClass] = useState("");
  const [aStream, setAStream] = useState<string>("");
  const [aSubject, setASubject] = useState<string>("");
  const filteredSubjects = (subjects ?? []).filter((s) => (!aClass || s.class_id === aClass) && (!aStream || s.stream_id === aStream || s.stream_id === null));

  async function addAssignment() {
    if (!assignFor || !aClass) return toast.error("Pick a class");
    const { error } = await supabase.from("teacher_assignments").insert({
      teacher_id: assignFor,
      class_id: aClass,
      stream_id: aStream || null,
      subject_id: aSubject || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Assigned");
    setAClass(""); setAStream(""); setASubject("");
    qc.invalidateQueries({ queryKey: ["assignments-all"] });
  }

  async function removeAssignment(id: string) {
    await supabase.from("teacher_assignments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["assignments-all"] });
  }

  async function removeTeacher(id: string) {
    if (!confirm("Remove teacher role from this user? Their account stays.")) return;
    await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "teacher");
    await supabase.from("teacher_assignments").delete().eq("teacher_id", id);
    qc.invalidateQueries({ queryKey: ["admin-teachers"] });
    qc.invalidateQueries({ queryKey: ["assignments-all"] });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">Teachers</h2>
          <p className="text-sm text-muted-foreground">Create teachers and assign them to classes, streams, and subjects.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="rounded-xl"><UserPlus className="size-4 mr-1" /> New teacher</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create teacher</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl" /></div>
                <div><Label>Mobile</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className="rounded-xl" /></div>
              </div>
              <div><Label>Initial password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} className="rounded-xl" /></div>
              <Button onClick={submitCreate} disabled={busy} className="w-full h-11 rounded-2xl">Create teacher</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4 space-y-2">
        {(teachers ?? []).length === 0 && <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">No teachers yet.</div>}
        {(teachers ?? []).map((t) => {
          const tAssigns = (assignments ?? []).filter((a) => a.teacher_id === t.id);
          return (
            <div key={t.id} className="rounded-2xl bg-card border border-border p-4 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.email} {t.mobile ? `• ${t.mobile}` : ""}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tAssigns.length === 0 && <span className="text-xs text-muted-foreground">No assignments</span>}
                    {tAssigns.map((a) => {
                      const row = a as { id: string; classes?: { name?: string } | null; streams?: { name?: string } | null; subjects?: { name?: string } | null };
                      return (
                        <span key={row.id} className="text-xs rounded-full bg-secondary px-2 py-1 inline-flex items-center gap-1">
                          {row.subjects?.name ?? "All subjects"} • {row.classes?.name}{row.streams?.name ? ` • ${row.streams.name}` : ""}
                          <button onClick={() => removeAssignment(row.id)} className="text-destructive ml-1">×</button>
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="rounded-xl h-8" onClick={() => setAssignFor(assignFor === t.id ? null : t.id)}><LinkIcon className="size-3.5 mr-1" /> Assign</Button>
                  <Button size="sm" variant="ghost" className="rounded-xl h-8 text-destructive" onClick={() => removeTeacher(t.id)}><Trash2 className="size-3.5" /></Button>
                </div>
              </div>
              {assignFor === t.id && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-border pt-3">
                  <Select value={aClass} onValueChange={setAClass}>
                    <SelectTrigger className="rounded-xl h-9"><SelectValue placeholder="Class" /></SelectTrigger>
                    <SelectContent>{(classes ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={aStream} onValueChange={setAStream}>
                    <SelectTrigger className="rounded-xl h-9"><SelectValue placeholder="Stream (opt)" /></SelectTrigger>
                    <SelectContent>{(streams ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={aSubject} onValueChange={setASubject}>
                    <SelectTrigger className="rounded-xl h-9"><SelectValue placeholder="Subject (opt)" /></SelectTrigger>
                    <SelectContent>{filteredSubjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button onClick={addAssignment} className="rounded-xl h-9"><Plus className="size-4 mr-1" /> Add</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* silence unused warning */}
      <div className="hidden">{teacherAssignments.length}</div>
    </div>
  );
}
