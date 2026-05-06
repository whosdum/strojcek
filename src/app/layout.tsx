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
    default:
      "Strojček Barbershop Bytča — pánsky strih, fade, úprava brady",
    template: "%s | Strojček Barbershop",
  },
  description:
    "Pánsky barber shop v Bytči — Strojček. Klasický pánsky strih, fade strih, úprava brady aj hot towel rituál. Rezervujte si termín online za 60 sekúnd.",
  keywords: [
    "barber",
    "barber shop",
    "barbershop",
    "barber Bytča",
    "bytča barber",
    "barbershop Bytča",
    "Bytča",
    "Žilina",
    "pánsky strih",
    "pánsky strih Bytča",
    "fade strih",
    "klasický strih",
    "úprava brady",
    "úprava fúzov",
    "hot towel",
    "holič",
    "holič Bytča",
    "kaderník",
    "kaderník Bytča",
    "pánsky kaderník",
    "Strojček",
    "rezervácia",
    "rezervácia online",
    "online rezervácia holič",
  ],
  authors: [{ name: "STROJČEK s.r.o." }],
  creator: "STROJČEK s.r.o.",
  openGraph: {
    type: "website",
    locale: "sk_SK",
    url: PUBLIC_SITE_URL,
    siteName: "Strojček Barbershop",
    title: "Strojček Barbershop Bytča — pánsky strih, fade, úprava brady",
    description:
      "Pánsky barber shop v Bytči — Strojček. Klasický pánsky strih, fade strih, úprava brady aj hot towel rituál. Rezervujte si termín online za 60 sekúnd.",
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
    title: "Strojček Barbershop Bytča — pánsky strih, fade, úprava brady",
    description:
      "Pánsky barber shop v Bytči — Strojček. Klasický pánsky strih, fade strih, úprava brady aj hot towel rituál. Rezervujte si termín online za 60 sekúnd.",
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
