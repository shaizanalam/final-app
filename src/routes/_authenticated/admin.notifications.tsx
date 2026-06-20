import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Send, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: AdminNotifications,
});

function AdminNotifications() {
  const { data: session } = useSession();
  const qc = useQueryClient();

  const { data: classes } = useQuery({
    queryKey: ["classes-all"],
    queryFn: async () => (await supabase.from("classes").select("id,name").order("display_order")).data ?? [],
  });
  const { data: streams } = useQuery({
    queryKey: ["streams-all"],
    queryFn: async () => (await supabase.from("streams").select("id,name")).data ?? [],
  });
  const { data: list } = useQuery({
    queryKey: ["all-notifications"],
    queryFn: async () =>
      (await supabase.from("notifications")
        .select("*, classes:classes!notifications_target_class_id_fkey(name), streams:streams!notifications_target_stream_id_fkey(name)")
        .order("created_at", { ascending: false })
        .limit(50)).data ?? [],
  });

  const [form, setForm] = useState<{ title: string; body: string; target: "all" | "class" | "stream"; classId?: string; streamId?: string }>({ title: "", body: "", target: "all" });

  async function send() {
    if (!form.title.trim() || !form.body.trim()) return toast.error("Title and body required");
    if (form.target === "class" && !form.classId) return toast.error("Pick a class");
    if (form.target === "stream" && !form.streamId) return toast.error("Pick a stream");
    const { error } = await supabase.from("notifications").insert({
      title: form.title.trim(),
      body: form.body.trim(),
      target_type: form.target,
      target_class_id: form.target === "class" ? form.classId! : null,
      target_stream_id: form.target === "stream" ? form.streamId! : null,
      created_by: session!.userId!,
    });
    if (error) return toast.error(error.message);
    toast.success("Notification sent");
    setForm({ title: "", body: "", target: "all" });
    qc.invalidateQueries({ queryKey: ["all-notifications"] });
  }

  async function del(id: string) {
    await supabase.from("notifications").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["all-notifications"] });
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="rounded-3xl bg-card border border-border p-5 shadow-soft space-y-3">
        <h2 className="font-bold text-lg">Compose</h2>
        <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-xl" maxLength={120} /></div>
        <div><Label>Message</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="rounded-xl" rows={4} maxLength={2000} /></div>
        <div>
          <Label>Send to</Label>
          <Select value={form.target} onValueChange={(v) => setForm({ ...form, target: v as "all" | "class" | "stream" })}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All students</SelectItem>
              <SelectItem value="class">Specific class</SelectItem>
              <SelectItem value="stream">Specific stream</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.target === "class" && (
          <Select value={form.classId ?? ""} onValueChange={(v) => setForm({ ...form, classId: v })}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Pick class" /></SelectTrigger>
            <SelectContent>{(classes ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {form.target === "stream" && (
          <Select value={form.streamId ?? ""} onValueChange={(v) => setForm({ ...form, streamId: v })}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Pick stream" /></SelectTrigger>
            <SelectContent>{(streams ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Button onClick={send} className="w-full h-11 rounded-2xl"><Send className="size-4 mr-1" /> Send notification</Button>
      </div>

      <div>
        <h2 className="font-bold text-lg">Recent</h2>
        <div className="mt-3 space-y-2">
          {(list ?? []).length === 0 && <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">No notifications yet.</div>}
          {(list ?? []).map((n) => {
            const row = n as { id: string; title: string; body: string; target_type: string; classes?: { name?: string } | null; streams?: { name?: string } | null; created_at: string };
            return (
              <div key={row.id} className="rounded-2xl bg-card border border-border p-3 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{row.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{row.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      → {row.target_type === "all" ? "All students" : row.target_type === "class" ? `Class ${row.classes?.name ?? ""}` : `Stream ${row.streams?.name ?? ""}`} • {new Date(row.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(row.id)}><Trash2 className="size-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
