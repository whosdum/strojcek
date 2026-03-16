import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rezervácia — Strojček",
  description: "Rezervujte si termín online v barbershope Strojček",
};

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-8">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Strojček</h1>
        <p className="text-sm text-muted-foreground">Online rezervácia</p>
      </header>
      {children}
    </div>
  );
}
