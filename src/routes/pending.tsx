import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/pending")({
  head: () => ({ meta: [{ title: "Waiting for approval — CCI LearnHub" }] }),
  component: PendingPage,
});

function PendingPage() {
  const navigate = useNavigate();
  const { data, refetch, isFetching } = useSession();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const blocked = data?.profile?.status === "blocked";

  return (
    <div className="min-h-screen grid place-items-center px-5 bg-background">
      <div className="max-w-md w-full text-center rounded-3xl bg-card p-8 shadow-soft border border-border">
        <div className="mx-auto size-16 rounded-2xl bg-accent/20 grid place-items-center">
          <Clock className="size-8 text-accent-foreground" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-extrabold">
          {blocked ? "Account blocked" : "Almost there!"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {blocked
            ? "Your account is currently blocked. Please contact your administrator."
            : `Hey ${data?.profile?.name ?? "there"} 👋 — your account is waiting for an admin to approve it. You'll get in as soon as that's done.`}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => refetch()} disabled={isFetching} className="rounded-2xl h-11">
            <RefreshCw className={`size-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Check again
          </Button>
          <Button variant="ghost" onClick={signOut} className="rounded-2xl h-11">
            <LogOut className="size-4 mr-2" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
