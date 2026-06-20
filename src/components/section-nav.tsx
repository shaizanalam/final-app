import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ComponentType } from "react";

export type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
};

export function SectionShell({
  title,
  subtitle,
  items,
  children,
  maxWidth = "max-w-5xl",
}: {
  title: string;
  subtitle?: string;
  items: NavItem[];
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const loc = useLocation();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-hero text-white px-6 py-6">
        <div className={`${maxWidth} mx-auto flex items-center justify-between`}>
          <div>
            {subtitle && <p className="text-sm opacity-80">{subtitle}</p>}
            <h1 className="font-display text-2xl font-extrabold">{title}</h1>
          </div>
          <Button onClick={signOut} variant="secondary" size="sm" className="rounded-xl">
            <LogOut className="size-4 mr-1" /> Sign out
          </Button>
        </div>
      </header>

      <nav className={`${maxWidth} mx-auto px-4 sm:px-6 pt-4 overflow-x-auto`}>
        <div className="flex items-center gap-1 border-b border-border">
          {items.map((it) => {
            const active = it.exact ? loc.pathname === it.to : loc.pathname.startsWith(it.to) && (it.to !== "/teacher" && it.to !== "/admin" ? true : loc.pathname === it.to);
            return (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              <Link key={it.to} to={it.to as any} className={`group px-3 sm:px-4 py-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 -mb-px whitespace-nowrap transition ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <it.icon className="size-4" />
                {it.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className={`${maxWidth} mx-auto px-4 sm:px-6 py-6`}>{children}</main>
    </div>
  );
}
