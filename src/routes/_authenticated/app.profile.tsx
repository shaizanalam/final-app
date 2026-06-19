import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LogOut, Mail, Phone, BookOpen, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const { data: klass } = useQuery({
    queryKey: ["my-class", session?.studentDetails?.class_id],
    queryFn: async () => {
      if (!session?.studentDetails?.class_id) return null;
      const { data } = await supabase.from("classes").select("name").eq("id", session.studentDetails.class_id).maybeSingle();
      return data;
    },
    enabled: !!session?.studentDetails?.class_id,
  });
  const { data: stream } = useQuery({
    queryKey: ["my-stream", session?.studentDetails?.stream_id],
    queryFn: async () => {
      if (!session?.studentDetails?.stream_id) return null;
      const { data } = await supabase.from("streams").select("name").eq("id", session.studentDetails.stream_id).maybeSingle();
      return data;
    },
    enabled: !!session?.studentDetails?.stream_id,
  });

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

      <Button onClick={signOut} variant="outline" className="mt-6 w-full h-12 rounded-2xl">
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
