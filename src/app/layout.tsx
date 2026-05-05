import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PUBLIC_SITE_URL } from "@/lib/business-info";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  title: {
    default: "Strojček — Barbershop Bytča",
    template: "%s | Strojček",
  },
  description:
    "Pánsky barber shop v Bytči — Strojček barbershop. Strih, úprava brady, hot towel rituál. Rezervujte si termín online.",
  keywords: [
    "barber",
    "barber shop",
    "barbershop",
    "Bytča",
    "pánsky strih",
    "úprava brady",
    "Strojček",
    "holič",
    "rezervácia",
  ],
  authors: [{ name: "STROJČEK s.r.o." }],
  creator: "STROJČEK s.r.o.",
  openGraph: {
    type: "website",
    locale: "sk_SK",
    url: PUBLIC_SITE_URL,
    siteName: "Strojček",
    title: "Strojček — Barbershop Bytča",
    description:
      "Pánsky barber shop v Bytči — Strojček barbershop. Strih, úprava brady, hot towel rituál. Rezervujte si termín online.",
    images: [
      {
        url: "/logo.jpg",
        width: 800,
        height: 600,
        alt: "Strojček — barber shop Bytča",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Strojček — Barbershop Bytča",
    description:
      "Pánsky barbershop v Bytči. Rezervujte si termín online.",
    images: ["/logo.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sk">
      <body className={`${jakarta.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
