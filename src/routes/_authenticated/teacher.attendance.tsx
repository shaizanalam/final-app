import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCheck, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/teacher/attendance")({
  component: TeacherAttendance;
});

function TeacherAttendance() {
  const { data: session } = useSession();
  const userId = session?.userId;
  const qc = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [classId, setClassId] = useState<string>("");

  const { data: assignments } = useQuery({
    queryKey: ["my-assignments", userId],
    queryFn: async () =>
      (await supabase
        .from("teacher_assignments")
        .select("class_id, classes(name), stream_id, streams(name)")
        .eq("teacher_id", userId!)).data ?? [],
    enabled: !!userId,
  });

  const classes = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    (assignments ?? []).forEach((a) => {
      const row = a as { class_id: string; classes?: { name?: string } | null; streams?: { name?: string } | null };
      map.set(row.class_id, { id: row.class_id, label: `${row.classes?.name}${row.streams?.name ? ` • ${row.streams.name}` : ""}` });
    });
    return [...map.values()];
  }, [assignments]);

  const { data: students } = useQuery({
    queryKey: ["roster", classId],
    queryFn: async () =>
      classId
        ? (await supabase
            .from("student_details")
            .select("profile_id, profiles!inner(name, status)")
            .eq("class_id", classId)).data ?? []
        : [],
    enabled: !!classId,
  });

  const { data: existing } = useQuery({
    queryKey: ["attendance", classId, date],
    queryFn: async () =>
      classId
        ? (await supabase
            .from("attendance")
            .select("student_id,status")
            .eq("class_id", classId)
            .eq("date", date)).data ?? []
        : [],
    enabled: !!classId,
  });

  const existingMap = useMemo(() => {
    const m = new Map<string, "present" | "absent">();
    (existing ?? []).forEach((r) => m.set(r.student_id, r.status as "present" | "absent"));
    return m;
  }, [existing]);

  const [marks, setMarks] = useState<Record<string, "present" | "absent">>({});
  const view = useMemo(() => {
    const out: Record<string, "present" | "absent"> = {};
    (students ?? []).forEach((s) => {
      const sid = (s as { profile_id: string }).profile_id;
      out[sid] = marks[sid] ?? existingMap.get(sid) ?? "present";
    });
    return out;
  }, [students, marks, existingMap]);

  async function save() {
    if (!classId) return;
    const rows = Object.entries(view).map(([student_id, status]) => ({ student_id, status, date, class_id: classId, marked_by: userId! }));
    if (!rows.length) return toast.error("No students");
    // delete existing then insert
    await supabase.from("attendance").delete().eq("class_id", classId).eq("date", date);
    const { error } = await supabase.from("attendance").insert(rows);
    if (error) return toast.error(error.message);
    toast.success("Attendance saved");
    setMarks({});
    qc.invalidateQueries({ queryKey: ["attendance", classId, date] });
  }

  function bulk(status: "present" | "absent") {
    const next: Record<string, "present" | "absent"> = {};
    (students ?? []).forEach((s) => { next[(s as { profile_id: string }).profile_id] = status; });
    setMarks(next);
  }

  return (
    <div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <Label>Class</Label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder={classes.length ? "Pick class" : "No classes"} /></SelectTrigger>
            <SelectContent>
              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl" />
        </div>
        <div className="flex items-end gap-2">
          <Button variant="outline" className="rounded-xl flex-1" onClick={() => bulk("present")}><CheckCheck className="size-4 mr-1" /> All present</Button>
          <Button variant="outline" className="rounded-xl flex-1" onClick={() => bulk("absent")}><X className="size-4 mr-1" /> All absent</Button>
        </div>
      </div>

      <div className="mt-5 rounded-3xl bg-card border border-border shadow-soft overflow-hidden">
        {!classId && <div className="p-8 text-center text-muted-foreground text-sm">Pick a class to start marking.</div>}
        {classId && (students ?? []).length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">No students in this class yet.</div>}
        {(students ?? []).map((s) => {
          const row = s as { profile_id: string; profiles?: { name?: string; status?: string } };
          const status = view[row.profile_id];
          return (
            <div key={row.profile_id} className="px-4 py-3 border-b border-border last:border-0 flex items-center justify-between">
              <p className="font-semibold">{row.profiles?.name}</p>
              <div className="flex gap-2">
                <Button size="sm" variant={status === "present" ? "default" : "outline"} className="rounded-xl h-9" onClick={() => setMarks((m) => ({ ...m, [row.profile_id]: "present" }))}>Present</Button>
                <Button size="sm" variant={status === "absent" ? "destructive" : "outline"} className="rounded-xl h-9" onClick={() => setMarks((m) => ({ ...m, [row.profile_id]: "absent" }))}>Absent</Button>
              </div>
            </div>
          );
        })}
      </div>

      {classId && (students ?? []).length > 0 && (
        <Button onClick={save} className="mt-4 w-full h-12 rounded-2xl">Save attendance</Button>
      )}
    </div>
  );
}
