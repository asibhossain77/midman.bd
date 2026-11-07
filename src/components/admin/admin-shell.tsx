"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Ban,
  ExternalLink,
  FileCheck2,
  Handshake,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
  ShieldCheck,
  type LucideIcon,
  Users,
  Wallet,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LanguageToggle } from "@/components/theme/language-toggle";
import { SiteLogo, SiteMark } from "@/components/branding/site-logo";
import { useLanguage } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";

/**
 * Midman.bd admin shell — the Verify admin's sidebar design language:
 * DESKTOP (md+): persistent, collapsible sidebar + sticky topbar.
 * MOBILE: the same navigation in an off-canvas Sheet opened by the
 * topbar trigger. Authorization is NOT done here — this renders only
 * for users the admin layout already approved server-side.
 */

export interface AdminShellUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface NavItem {
  href: string;
  /** Key into dict.admin.nav */
  label: keyof ReturnType<typeof useLanguage>["dict"]["admin"]["nav"];
  icon: LucideIcon;
}

const NAV_GROUPS: {
  label: keyof ReturnType<typeof useLanguage>["dict"]["admin"]["navGroups"];
  items: NavItem[];
}[] = [
  {
    label: "overview",
    items: [{ href: "/admin", label: "dashboard", icon: LayoutDashboard }],
  },
  {
    label: "escrow",
    items: [
      { href: "/admin/deals", label: "deals", icon: Handshake },
      { href: "/admin/payments", label: "payments", icon: FileCheck2 },
      { href: "/admin/disputes", label: "disputes", icon: Ban },
      { href: "/admin/transactions", label: "transactions", icon: Wallet },
    ],
  },
  {
    label: "people",
    items: [{ href: "/admin/users", label: "users", icon: Users }],
  },
  {
    label: "platform",
    items: [
      { href: "/admin/audit-logs", label: "auditLogs", icon: ScrollText },
      { href: "/admin/settings", label: "settings", icon: Settings },
    ],
  },
];

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({
  user,
  children,
}: {
  user: AdminShellUser;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AdminSidebar user={user} />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <AdminTopbar user={user} />
        <div className="min-w-0 flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AdminSidebar({ user }: { user: AdminShellUser }) {
  const { dict } = useLanguage();
  const t = dict.admin;
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
  const closeMobileNav = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="gap-0 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip={t.panel}
              className="h-12 data-[active=true]:bg-transparent data-[active=true]:text-sidebar-foreground"
            >
              <Link
                href="/admin"
                aria-label={t.panel}
                onClick={closeMobileNav}
                className="min-w-0 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="flex min-w-0 items-center gap-2 group-data-[collapsible=icon]:hidden">
                  <SiteLogo imageClassName="h-8" />
                </span>
                <span className="hidden size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground group-data-[collapsible=icon]:flex">
                  <SiteMark className="size-6" />
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{t.navGroups[group.label]}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isItemActive(pathname, item.href);
                  const label = t.nav[item.label];
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={label}
                        className="h-11 md:h-9 data-[active=true]:bg-primary/10 data-[active=true]:text-primary-text"
                      >
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          onClick={closeMobileNav}
                          className="outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <item.icon
                            className={cn(
                              active ? "text-primary-text" : "text-muted-foreground"
                            )}
                            aria-hidden="true"
                          />
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <AdminSidebarUser user={user} />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t.backToSite} className="h-11 md:h-9">
              <a
                href="/"
                onClick={closeMobileNav}
                className="outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <ExternalLink className="text-muted-foreground" aria-hidden="true" />
                <span>{t.backToSite}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function AdminSidebarUser({ user }: { user: AdminShellUser }) {
  const { dict } = useLanguage();
  const t = dict.admin;
  const initial = user.name?.charAt(0).toUpperCase() || "?";
  const roleLabel =
    t.roles[user.role as keyof typeof t.roles] ?? user.role;

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card p-2">
      <Avatar className="size-8">
        <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
          {initial}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm font-medium">{user.name}</span>
        <span className="truncate text-xs font-medium text-verified-text">
          {roleLabel}
        </span>
      </div>
    </div>
  );
}

function AdminTopbar({ user }: { user: AdminShellUser }) {
  const { dict } = useLanguage();
  const t = dict.admin;
  const pathname = usePathname();

  const current = NAV_GROUPS.flatMap((group) => group.items).find((item) =>
    isItemActive(pathname, item.href)
  );
  const currentLabel = current ? t.nav[current.label] : t.panel;

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:gap-3 sm:px-4 lg:px-6">
      <SidebarTrigger aria-label={t.toggleSidebar} className="size-9 md:size-8" />
      <Separator orientation="vertical" className="!h-5" />
      <h1 className="min-w-0 truncate text-sm font-semibold sm:text-base">
        {currentLabel}
      </h1>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <LanguageToggle />
        <ThemeToggle />
        <AdminUserMenu user={user} />
      </div>
    </header>
  );
}

function AdminUserMenu({ user }: { user: AdminShellUser }) {
  const { dict } = useLanguage();
  const t = dict.admin;
  const initial = user.name?.charAt(0).toUpperCase() || "?";
  const roleLabel = t.roles[user.role as keyof typeof t.roles] ?? user.role;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative size-9 rounded-full p-0 md:size-8"
          aria-label={`${t.signedInAs} ${user.name}`}
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              {initial}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <DropdownMenuLabel className="space-y-1">
          <p className="text-sm font-semibold leading-tight">{user.name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">
            {user.email}
          </p>
          <div className="flex items-center gap-1.5 pt-1">
            <Badge className="bg-primary text-primary-foreground">
              <ShieldCheck className="size-3" aria-hidden="true" />
              {roleLabel}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px]">
              ID {user.id}
            </Badge>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <a href="/">
              <ExternalLink aria-hidden="true" />
              {t.viewSite}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <button
              type="button"
              className="flex w-full items-center text-destructive"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/";
              }}
            >
              <LogOut aria-hidden="true" />
              {t.signOut}
            </button>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

