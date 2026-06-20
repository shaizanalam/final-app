import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, UserCheck, UserX, Users, BookOpen, GraduationCap, Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminStudents,
});

function AdminStudents() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "blocked">("all");

  const { data: students } = useQuery({
    queryKey: ["admin-students"],
    queryFn: async () =>
      (await supabase
        .from("profiles")
        .select("id,name,email,mobile,status,created_at, student_details(class_id, stream_id, classes(name), streams(name))")
        .order("created_at", { ascending: false })).data ?? [],
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [{ count: prof }, { count: tests }, { count: mats }, { count: att }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("tests").select("*", { count: "exact", head: true }),
        supabase.from("materials").select("*", { count: "exact", head: true }),
        supabase.from("notifications").select("*", { count: "exact", head: true }),
      ]);
      return { profiles: prof ?? 0, tests: tests ?? 0, materials: mats ?? 0, notes: att ?? 0 };
    },
  });

  async function setStatus(id: string, status: "approved" | "blocked" | "pending") {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    qc.invalidateQueries({ queryKey: ["admin-students"] });
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (students ?? []).filter((s) => {
      if (filter !== "all" && s.status !== filter) return false;
      if (!term) return true;
      return s.name.toLowerCase().includes(term) || (s.email ?? "").toLowerCase().includes(term) || (s.mobile ?? "").toLowerCase().includes(term);
    });
  }, [students, q, filter]);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={Users} label="Users" value={stats?.profiles ?? 0} />
        <Stat icon={BookOpen} label="Materials" value={stats?.materials ?? 0} />
        <Stat icon={GraduationCap} label="Tests" value={stats?.tests ?? 0} />
        <Stat icon={Bell} label="Notifications" value={stats?.notes ?? 0} />
      </div>

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 rounded-xl h-11" placeholder="Search by name, email or mobile" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {(["all", "pending", "approved", "blocked"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="rounded-xl capitalize" onClick={() => setFilter(f)}>{f}</Button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-3xl bg-card border border-border shadow-soft overflow-hidden">
        <div className="hidden sm:grid grid-cols-12 px-4 py-3 text-xs font-bold text-muted-foreground uppercase border-b border-border">
          <div className="col-span-4">Name</div>
          <div className="col-span-3">Class / Stream</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3 text-right">Actions</div>
        </div>
        {filtered.map((s) => {
          const row = s as { id: string; name: string; email: string | null; status: string; student_details?: { classes?: { name?: string } | null; streams?: { name?: string } | null } | null };
          const klass = row.student_details?.classes?.name;
          const stream = row.student_details?.streams?.name;
          return (
            <div key={row.id} className="grid grid-cols-1 sm:grid-cols-12 px-4 py-3 gap-2 items-center text-sm border-b border-border last:border-0">
              <div className="sm:col-span-4">
                <p className="font-semibold">{row.name}</p>
                <p className="text-xs text-muted-foreground">{row.email}</p>
              </div>
              <div className="sm:col-span-3 text-muted-foreground text-xs sm:text-sm">{klass ?? "—"} {stream ? `• ${stream}` : ""}</div>
              <div className="sm:col-span-2">
                <span className={`text-xs font-bold px-2 py-1 rounded-full capitalize ${row.status === "approved" ? "bg-primary/15 text-primary" : row.status === "blocked" ? "bg-destructive/15 text-destructive" : "bg-accent/20 text-accent-foreground"}`}>{row.status}</span>
              </div>
              <div className="sm:col-span-3 flex sm:justify-end gap-2">
                {row.status !== "approved" && <Button size="sm" className="rounded-xl h-8" onClick={() => setStatus(row.id, "approved")}><UserCheck className="size-3.5 mr-1" /> Approve</Button>}
                {row.status !== "blocked" && <Button size="sm" variant="outline" className="rounded-xl h-8" onClick={() => setStatus(row.id, "blocked")}><UserX className="size-3.5 mr-1" /> Block</Button>}
                {row.status === "blocked" && <Button size="sm" variant="ghost" className="rounded-xl h-8" onClick={() => setStatus(row.id, "pending")}>Reset</Button>}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">No users match.</div>}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-card border border-border p-5 shadow-soft">
      <div className="size-10 rounded-2xl bg-primary/15 text-primary grid place-items-center"><Icon className="size-5" /></div>
      <p className="mt-3 text-2xl font-extrabold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
