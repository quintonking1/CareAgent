import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentProfile } from "@/lib/profile";
import { getViewer } from "@/lib/viewer";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

// The original chat-first prototype (Chat, Overview, Profile, Demo controls), kept for reference
// and for the demo tooling. The new phone-first home lives at "/".
export default async function ClassicLayout({ children }: { children: React.ReactNode }) {
  const db = getDb();
  const profile = getCurrentProfile(db);
  const { viewer, members } = await getViewer(db, profile.id);
  const openAlerts = db.select().from(schema.alerts)
    .where(and(eq(schema.alerts.careProfileId, profile.id), eq(schema.alerts.status, "open"))).all().length;

  return (
    <div className="bg-background text-foreground">
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar parentName={profile.parentName} openAlerts={openAlerts} viewer={viewer} members={members} />
            <SidebarInset className="h-svh overflow-hidden">{children}</SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </ThemeProvider>
    </div>
  );
}
