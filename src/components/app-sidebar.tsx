"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, FlaskConical, HeartPulse, House, MessageSquare, UserRound } from "lucide-react";
import { setViewer } from "@/app/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarMenu, SidebarMenuBadge,
  SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

export interface Member {
  id: number;
  name: string;
  role: string;
}

const COLORS: Record<string, string> = {
  primary_caregiver: "bg-violet-600",
  co_caregiver: "bg-cyan-600",
  parent: "bg-emerald-600",
};
const initials = (name: string) => name.split(" ").map((p) => p[0]).join("");
const roleName = (role: string) => role.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase());

export function MemberAvatar({ member, className = "size-8" }: { member: Member; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarFallback className={`${COLORS[member.role] ?? "bg-neutral-500"} text-xs font-semibold text-white`}>
        {initials(member.name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function AppSidebar({ parentName, openAlerts, viewer, members }: {
  parentName: string;
  openAlerts: number;
  viewer: Member;
  members: Member[];
}) {
  const path = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const close = () => isMobile && setOpenMobile(false);
  const first = parentName.split(" ")[0];
  const nav = [
    { href: "/", label: "Chat", icon: MessageSquare },
    { href: "/home", label: "Overview", icon: House, badge: openAlerts },
    { href: "/profile", label: `${first}'s profile`, icon: UserRound },
  ];

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/" onClick={close}>
                <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
                  <HeartPulse className="size-4" />
                </div>
                <div className="leading-tight">
                  <div className="font-semibold">CareAgent</div>
                  <div className="text-xs text-muted-foreground">Caring for {parentName}</div>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {nav.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={item.href === "/" ? path === "/" : path.startsWith(item.href)}>
                  <Link href={item.href} onClick={close}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
                {item.badge ? <SidebarMenuBadge className="rounded-full bg-destructive text-white">{item.badge}</SidebarMenuBadge> : null}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <MemberAvatar member={viewer} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="truncate font-medium">{viewer.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{roleName(viewer.role)}</div>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" className="w-64 rounded-xl">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">View as</DropdownMenuLabel>
                {members.map((m) => (
                  <DropdownMenuItem key={m.id} className="gap-3 py-2" onSelect={() => m.id !== viewer.id && setViewer(m.id)}>
                    <MemberAvatar member={m} className="size-7" />
                    <div className="flex-1 leading-tight">
                      <div>{m.name}</div>
                      <div className="text-xs text-muted-foreground">{roleName(m.role)}</div>
                    </div>
                    {m.id === viewer.id && <Check className="size-4" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/demo" onClick={close}><FlaskConical /> Demo controls</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
