import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Bookmark, BookOpen, FileText, Search, CheckCircle2 } from "lucide-react";
import { useSession } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/materials")({
  component: MaterialsPage,
});

function MaterialsPage() {
  const { data: session } = useSession();
  const [q, setQ] = useState("");

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("subjects").select("*").order("name")).data ?? [],
  });
  const { data: chapters } = useQuery({
    queryKey: ["chapters"],
    queryFn: async () => (await supabase.from("chapters").select("*").order("display_order")).data ?? [],
  });
  const { data: materials } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => (await supabase.from("materials").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: views } = useQuery({
    queryKey: ["views", session?.userId],
    queryFn: async () => (await supabase.from("material_views").select("material_id").eq("student_id", session!.userId!)).data ?? [],
    enabled: !!session?.userId,
  });
  const viewedIds = useMemo(() => new Set((views ?? []).map((v) => v.material_id)), [views]);

  async function openMaterial(m: { id: string; file_path: string; title: string }) {
    // mark viewed
    if (session?.userId) {
      await supabase.from("material_views").upsert({ material_id: m.id, student_id: session.userId }, { onConflict: "material_id,student_id" });
    }
    // sign URL for private bucket
    const { data, error } = await supabase.storage.from("materials").createSignedUrl(m.file_path, 60 * 10);
    if (error || !data?.signedUrl) return toast.error("File not available");
    // open in new tab — watermark overlay handled by future in-app viewer
    window.open(data.signedUrl, "_blank");
  }

  const filtered = (materials ?? []).filter((m) => m.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="px-5 pt-6 max-w-md mx-auto">
      <h1 className="font-display text-2xl font-extrabold">Materials</h1>
      <p className="text-sm text-muted-foreground">Everything your teachers shared for your class.</p>

      <div className="mt-4 relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9 rounded-2xl h-11" placeholder="Search materials" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {(subjects ?? []).length === 0 && (
        <div className="mt-8 rounded-3xl border border-dashed p-8 text-center text-muted-foreground">
          No subjects assigned to your class yet.
        </div>
      )}

      <Accordion type="multiple" className="mt-5">
        {(subjects ?? []).map((s) => {
          const subjectChapters = (chapters ?? []).filter((c) => c.subject_id === s.id);
          return (
            <AccordionItem key={s.id} value={s.id} className="border-0 mb-3">
              <AccordionTrigger className="rounded-2xl bg-card border border-border px-4 py-3 hover:no-underline shadow-soft">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-primary/15 text-primary grid place-items-center"><BookOpen className="size-5" /></div>
                  <span className="font-bold text-base">{s.name}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-3 pl-2">
                {subjectChapters.length === 0 && <p className="text-sm text-muted-foreground px-2">No chapters yet.</p>}
                {subjectChapters.map((ch) => {
                  const mats = filtered.filter((m) => m.chapter_id === ch.id);
                  return (
                    <div key={ch.id} className="mb-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground px-1">{ch.name}</p>
                      <div className="mt-2 space-y-2">
                        {mats.length === 0 && <p className="text-xs text-muted-foreground px-1">No materials</p>}
                        {mats.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => openMaterial(m)}
                            className="w-full text-left rounded-2xl bg-card border border-border p-3 shadow-soft flex items-center gap-3 hover:bg-secondary/40 transition"
                          >
                            <div className="size-9 rounded-xl bg-accent/20 text-accent-foreground grid place-items-center"><FileText className="size-4" /></div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{m.title}</p>
                              <p className="text-xs text-muted-foreground capitalize">{m.type.replace("_", " ")}</p>
                            </div>
                            {viewedIds.has(m.id) ? (
                              <CheckCircle2 className="size-4 text-primary" />
                            ) : (
                              <span className="text-[10px] font-bold rounded-full bg-accent/20 text-accent-foreground px-2 py-0.5">NEW</span>
                            )}
                            <Bookmark className="size-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
