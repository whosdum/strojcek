"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2Icon } from "lucide-react";

// Distinguish the server-side 403 reasons so the form shows a useful
// message instead of always blaming the user's account permissions.
function messageForFailure(status: number, errorCode?: string): string {
  if (status === 403 && errorCode === "no_admin_claim") {
    return "Tento účet nemá administrátorské oprávnenia.";
  }
  if (status === 403 && errorCode === "origin_mismatch") {
    return "Konfigurácia servera odmietla tento pôvod. Kontaktujte administrátora.";
  }
  if (status === 401) {
    return "Neplatný prihlasovací token. Skús to znova.";
  }
  return "Nepodarilo sa vytvoriť session. Skús znova.";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // When the page mounts, Firebase Auth may already have a user cached in
  // IndexedDB from a previous session. We CANNOT just redirect to /admin
  // on that signal alone — if the server-side __session cookie is missing
  // or invalid (failed prior login, expired, server-side revocation), the
  // middleware on /admin redirects right back to /login → infinite loop.
  //
  // Instead: when we see a user, POST a fresh ID token to the session
  // endpoint to (re)create the server cookie. If that succeeds, redirect.
  // If it fails (no admin claim, invalid token, etc.), sign the client
  // out so the next mount sees no user and shows the form.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setChecking(false);
        return;
      }
      try {
        const idToken = await user.getIdToken(true);
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (res.ok) {
          router.replace("/admin");
          return;
        }
        await signOut(auth).catch(() => {});
        const body = await res.json().catch(() => ({}));
        setError(messageForFailure(res.status, body?.error));
        setChecking(false);
      } catch {
        await signOut(auth).catch(() => {});
        setChecking(false);
      }
    });
    return () => unsub();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      // Force refresh so a freshly granted role=admin claim is in the
      // token. Without this, an admin whose claim was just set in
      // Firebase Auth will get "Tento účet nemá administrátorské
      // oprávnenia" until the next token rotation.
      const idToken = await credential.user.getIdToken(true);

      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        // Sign out the Firebase client so we don't leave a user behind
        // that the useEffect above would later try to "resume" — that's
        // exactly how the /login → /admin → /login loop got started.
        await signOut(auth).catch(() => {});
        const body = await res.json().catch(() => ({}));
        setError(messageForFailure(res.status, body?.error));
        setLoading(false);
        return;
      }

      router.replace("/admin");
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found" ||
        code === "auth/invalid-email"
      ) {
        setError("Nesprávny email alebo heslo.");
      } else if (code === "auth/too-many-requests") {
        setError("Príliš veľa pokusov. Skús neskôr.");
      } else {
        setError("Nastala chyba. Skúste to znova.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      {checking ? (
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      ) : (
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Strojček Admin</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Heslo</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                ) : null}
                Prihlásiť sa
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
