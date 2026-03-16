"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboardIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  ScissorsIcon,
  SparklesIcon,
  ClockIcon,
  UsersIcon,
  LogOutIcon,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/admin/calendar", label: "Kalendár", icon: CalendarDaysIcon },
  { href: "/admin/reservations", label: "Rezervácie", icon: ClipboardListIcon },
  { href: "/admin/barbers", label: "Barbieri", icon: ScissorsIcon },
  { href: "/admin/services", label: "Služby", icon: SparklesIcon },
  { href: "/admin/schedule", label: "Rozvrh", icon: ClockIcon },
  { href: "/admin/customers", label: "Zákazníci", icon: UsersIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-card">
      <div className="border-b px-4 py-4">
        <h2 className="text-lg font-bold">Strojček</h2>
        <p className="text-xs text-muted-foreground">Administrácia</p>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-2">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOutIcon className="size-4" />
          Odhlásiť sa
        </button>
      </div>
    </aside>
  );
}
