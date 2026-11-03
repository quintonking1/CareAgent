import { SidebarTrigger } from "@/components/ui/sidebar";

export function Topbar({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-2 bg-background/90 px-2 backdrop-blur">
      <div className="flex items-center gap-1">
        <SidebarTrigger className="size-9" />
        <h1 className="px-1 font-heading text-xl">{title}</h1>
      </div>
      {children}
    </header>
  );
}
