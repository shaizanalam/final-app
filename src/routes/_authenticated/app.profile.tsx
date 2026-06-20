import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { LogOut, Mail, Phone, BookOpen, GraduationCap, Pencil, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: session } = useSession();

  const { data: klass } = useQuery({
    queryKey: ["my-class", session?.studentDetails?.class_id],
    queryFn: async () =>
      session?.studentDetails?.class_id
        ? (await supabase.from("classes").select("name").eq("id", session.studentDetails.class_id).maybeSingle()).data
        : null,
    enabled: !!session?.studentDetails?.class_id,
  });
  const { data: stream } = useQuery({
    queryKey: ["my-stream", session?.studentDetails?.stream_id],
    queryFn: async () =>
      session?.studentDetails?.stream_id
        ? (await supabase.from("streams").select("name").eq("id", session.studentDetails.stream_id).maybeSingle()).data
        : null,
    enabled: !!session?.studentDetails?.stream_id,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", mobile: "" });
  useEffect(() => {
    if (session?.profile) setForm({ name: session.profile.name, mobile: session.profile.mobile ?? "" });
  }, [session]);

  async function save() {
    if (!form.name.trim()) return toast.error("Name required");
    const { error } = await supabase.from("profiles").update({ name: form.name.trim(), mobile: form.mobile.trim() || null }).eq("id", session!.userId!);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["session"] });
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="px-5 pt-6 max-w-md mx-auto">
      <div className="rounded-3xl bg-hero p-6 text-white shadow-glow text-center">
        <div className="mx-auto size-20 rounded-3xl bg-white/20 grid place-items-center text-3xl font-extrabold">
          {session?.profile?.name?.[0]?.toUpperCase() ?? "S"}
        </div>
        <h1 className="mt-3 font-display text-2xl font-extrabold">{session?.profile?.name}</h1>
        <p className="text-sm opacity-90 capitalize">{session?.profile?.status}</p>
      </div>

      <div className="mt-5 space-y-2">
        <Row icon={GraduationCap} label="Class" value={klass?.name ?? "—"} />
        {stream && <Row icon={BookOpen} label="Stream" value={stream.name} />}
        <Row icon={Mail} label="Email" value={session?.profile?.email ?? "—"} />
        <Row icon={Phone} label="Mobile" value={session?.profile?.mobile ?? "—"} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-11 rounded-2xl"><Pencil className="size-4 mr-2" /> Edit profile</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit profile</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl" /></div>
              <div><Label>Mobile</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className="rounded-xl" /></div>
              <Button onClick={save} className="w-full h-11 rounded-2xl">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Link to="/forgot-password">
          <Button variant="outline" className="w-full h-11 rounded-2xl"><KeyRound className="size-4 mr-2" /> Change password</Button>
        </Link>
      </div>

      <Button onClick={signOut} variant="ghost" className="mt-3 w-full h-12 rounded-2xl text-destructive">
        <LogOut className="size-4 mr-2" /> Sign out
      </Button>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4 shadow-soft flex items-center gap-3">
      <div className="size-9 rounded-xl bg-secondary text-secondary-foreground grid place-items-center"><Icon className="size-4" /></div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}
