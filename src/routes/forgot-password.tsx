import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — CCI LearnHub" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("If that email exists, a reset link is on its way.");
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen grid place-items-center px-5 bg-background">
      <div className="max-w-md w-full rounded-3xl bg-card p-8 shadow-soft border border-border">
        <Link to="/auth" className="text-sm text-muted-foreground inline-flex items-center gap-1"><ArrowLeft className="size-4" /> Back to sign in</Link>
        <h1 className="mt-3 font-display text-2xl font-extrabold">Reset your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">We'll email you a secure link to set a new one.</p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl" />
          </div>
          <Button disabled={busy} className="w-full h-11 rounded-2xl">Send reset link</Button>
        </form>
      </div>
    </div>
  );
}
