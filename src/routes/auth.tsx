import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — CCI LearnHub" }] }),
  component: AuthPage,
});

type Klass = { id: string; name: string; display_order: number };
type Stream = { id: string; name: string };

function AuthPage() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<Klass[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: cs }, { data: ss }] = await Promise.all([
        supabase.from("classes").select("*").order("display_order"),
        supabase.from("streams").select("*").order("name"),
      ]);
      setClasses((cs ?? []) as Klass[]);
      setStreams((ss ?? []) as Stream[]);
    })();
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) navigate({ to: "/" });
    })();
  }, [navigate]);

  // login
  const [loginId, setLoginId] = useState("");
  const [loginPass, setLoginPass] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    let email = loginId.trim();
    // Allow login by mobile: look up email via profiles
    if (!email.includes("@")) {
      const { data } = await supabase.from("profiles").select("email").eq("mobile", email).maybeSingle();
      if (!data?.email) {
        setLoading(false);
        toast.error("No account with that mobile number.");
        return;
      }
      email = data.email;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password: loginPass });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate({ to: "/" });
  }

  // signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [streamId, setStreamId] = useState<string>("");

  const selectedClass = classes.find((c) => c.id === classId);
  const needsStream = selectedClass && (selectedClass.name.includes("11") || selectedClass.name.includes("12"));

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) return toast.error("Please pick your class.");
    if (needsStream && !streamId) return toast.error("Please pick your stream.");
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { name: name.trim(), mobile: mobile.trim() },
      },
    });
    if (error || !data.user) {
      setLoading(false);
      return toast.error(error?.message ?? "Sign up failed");
    }

    // Create student_details row (RLS allows self-insert)
    const { error: sdErr } = await supabase.from("student_details").insert({
      profile_id: data.user.id,
      class_id: classId,
      stream_id: needsStream ? streamId : null,
    });
    setLoading(false);
    if (sdErr) return toast.error(`Saved account, but couldn't save class: ${sdErr.message}`);

    toast.success("Account created! Waiting for admin approval.");
    navigate({ to: "/pending" });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex bg-hero text-white p-12 flex-col justify-between">
        <Link to="/" className="font-display text-2xl font-extrabold">CCI LearnHub</Link>
        <div>
          <h2 className="text-4xl font-extrabold leading-tight">Your class. Your stream.<br/>Your hub.</h2>
          <p className="mt-4 text-white/90 max-w-md">Materials, tests and progress — neatly organized for exactly what you're studying. No noise, no group chats.</p>
        </div>
        <p className="text-sm text-white/70">© Chhattisgarh Coaching Institute</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <div className="mx-auto size-14 rounded-2xl bg-hero grid place-items-center text-white font-bold shadow-glow">CCI</div>
            <h1 className="mt-3 font-display text-2xl font-extrabold">LearnHub</h1>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid grid-cols-2 w-full rounded-2xl">
              <TabsTrigger value="login" className="rounded-xl">Login</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-xl">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label>Email or Mobile</Label>
                  <Input value={loginId} onChange={(e) => setLoginId(e.target.value)} required className="rounded-xl" />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input type="password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} required className="rounded-xl" />
                </div>
                <Button disabled={loading} type="submit" className="w-full h-12 rounded-2xl text-base font-semibold shadow-soft">
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Login"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignup} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Full name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} required className="rounded-xl" />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl" />
                  </div>
                  <div>
                    <Label>Mobile</Label>
                    <Input value={mobile} onChange={(e) => setMobile(e.target.value)} required className="rounded-xl" />
                  </div>
                  <div>
                    <Label>Class</Label>
                    <Select value={classId} onValueChange={setClassId}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Stream</Label>
                    <Select value={streamId} onValueChange={setStreamId} disabled={!needsStream}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder={needsStream ? "Select" : "Not required"} /></SelectTrigger>
                      <SelectContent>
                        {streams.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Password</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="rounded-xl" />
                  </div>
                </div>
                <Button disabled={loading} type="submit" className="w-full h-12 rounded-2xl text-base font-semibold shadow-soft">
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Your account needs admin approval before you can sign in.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
