"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  MenuIcon,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase-client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/admin/calendar", label: "Kalendár", icon: CalendarDaysIcon },
  { href: "/admin/reservations", label: "Rezervácie", icon: ClipboardListIcon },
  { href: "/admin/barbers", label: "Barberi", icon: ScissorsIcon },
  { href: "/admin/services", label: "Služby", icon: SparklesIcon },
  { href: "/admin/schedule", label: "Rozvrh", icon: ClockIcon },
  { href: "/admin/customers", label: "Zákazníci", icon: UsersIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    // Clear server cookie + revoke Firebase refresh tokens FIRST.
    // If we sign out the client SDK first and the server fetch then fails
    // (offline, network blip), the cookie keeps the user "logged in" on
    // the server side while the client has no Firebase user — desync.
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch (e) {
      console.error("[logout][server]", e);
    }
    try {
      await signOut(auth);
    } catch (e) {
      console.error("[logout][client]", e);
    }
    setOpen(false);
    router.push("/login");
  };

  const navContent = (
    <>
      <div className="border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.jpg"
            alt="Strojček"
            width={36}
            height={20}
            className="rounded"
          />
          <div>
            <h2 className="text-lg font-bold text-primary">Strojček</h2>
            <p className="text-xs text-muted-foreground">Administrácia</p>
          </div>
        </div>
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
              onClick={() => setOpen(false)}
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
          onClick={() => setShowLogoutConfirm(true)}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOutIcon className="size-4" />
          Odhlásiť sa
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Image src="/logo.jpg" alt="Strojček" width={28} height={15} className="rounded" />
            <div>
              <p className="text-sm font-semibold text-primary">Strojček</p>
              <p className="text-xs text-muted-foreground">Administrácia</p>
            </div>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-expanded={open}
                  aria-controls="admin-mobile-nav"
                />
              }
            >
              <MenuIcon className="size-4" />
              <span className="sr-only">Otvoriť menu</span>
            </SheetTrigger>
            <SheetContent
              id="admin-mobile-nav"
              side="left"
              className="w-[85vw] max-w-sm p-0"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Navigácia administrácie</SheetTitle>
                <SheetDescription>
                  Navigácia medzi admin sekciami.
                </SheetDescription>
              </SheetHeader>
              <div className="flex h-full flex-col bg-card">
                {navContent}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <aside className="hidden h-screen w-60 shrink-0 flex-col border-r bg-card md:flex">
        {navContent}
      </aside>

      <AlertDialog open={showLogoutConfirm} onOpenChange={(open) => !open && setShowLogoutConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odhlásiť sa?</AlertDialogTitle>
            <AlertDialogDescription>
              Naozaj sa chcete odhlásiť z administrácie?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}>
              Odhlásiť sa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
