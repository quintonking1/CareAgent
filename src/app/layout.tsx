import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCurrentProfile } from "@/lib/profile";
import { getViewer } from "@/lib/viewer";
import { cn } from "@/lib/utils";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CareAgent",
  description: "Care admin agent for families (class prototype, synthetic data only)",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const db = getDb();
  const profile = getCurrentProfile(db);
  const { viewer, members } = await getViewer(db, profile.id);
  const openAlerts = db.select().from(schema.alerts)
    .where(and(eq(schema.alerts.careProfileId, profile.id), eq(schema.alerts.status, "open"))).all().length;

  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", inter.variable)}>
      <body className="bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <SidebarProvider>
              <AppSidebar parentName={profile.parentName} openAlerts={openAlerts} viewer={viewer} members={members} />
              <SidebarInset className="h-svh overflow-hidden">{children}</SidebarInset>
            </SidebarProvider>
            <Toaster position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
