
"use client";

import { usePathname } from "next/navigation";
import {
  Calendar,
  LayoutDashboard,
  Settings,
  CreditCard,
  Mail,
  Bug,
} from "lucide-react";

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { UserNav } from "./user-nav";
import { Separator } from "./ui/separator";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
            <Calendar className="text-primary-foreground" />
            <h1 className="text-xl font-semibold text-primary-foreground">
              Calendar Sentinel
            </h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive("/dashboard")}
                tooltip="Dashboard"
              >
                <Link href="/dashboard">
                  <LayoutDashboard />
                  Dashboard
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
               <SidebarMenuButton
                asChild
                isActive={isActive("/calendars")}
                tooltip="Calendars"
              >
                <Link href="/calendars">
                  <Calendar />
                  Calendars
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
               <SidebarMenuButton
                asChild
                isActive={isActive("/inbox")}
                tooltip="Inbox"
              >
                <Link href="/inbox">
                  <Mail />
                  Inbox
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
             <SidebarMenuItem>
               <SidebarMenuButton
                asChild
                isActive={isActive("/billing")}
                tooltip="Billing"
              >
                <Link href="/billing">
                  <CreditCard />
                  Billing
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
               <SidebarMenuButton
                asChild
                isActive={isActive("/settings")}
                tooltip="Settings"
              >
                <Link href="/settings">
                  <Settings />
                  Settings
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <Separator className="my-2 bg-sidebar-border/50" />
            <SidebarMenuItem>
               <SidebarMenuButton
                asChild
                isActive={isActive("/admin/logs")}
                tooltip="Webhook Logs"
              >
                <Link href="/admin/logs">
                  <Bug />
                  Webhook Logs
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <Separator className="my-2 bg-sidebar-border" />
          <div className="p-4 text-sm text-sidebar-foreground/70">
            <p>&copy; {new Date().getFullYear()} Calendar Sentinel</p>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm sm:px-8">
          <SidebarTrigger />
          <UserNav />
        </header>
        <main className="flex-1 p-4 sm:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
