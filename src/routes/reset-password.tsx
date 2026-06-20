import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set new password — CCI LearnHub" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return toast.error("Password must be at least 6 characters");
    if (pw !== pw2) return toast.error("Passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen grid place-items-center px-5 bg-background">
      <div className="max-w-md w-full rounded-3xl bg-card p-8 shadow-soft border border-border">
        <h1 className="font-display text-2xl font-extrabold">Set a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Make it long, make it strong.</p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <div><Label>New password</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required className="rounded-xl" minLength={6} /></div>
          <div><Label>Confirm password</Label><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required className="rounded-xl" minLength={6} /></div>
          <Button disabled={busy} className="w-full h-11 rounded-2xl">Update password</Button>
        </form>
      </div>
    </div>
  );
}
