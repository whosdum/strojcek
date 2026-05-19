import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PUBLIC_SITE_URL } from "@/lib/business-info";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#fc873a",
  colorScheme: "light",
};

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const SITE_TITLE =
  "Strojček Barbershop Bytča | Bytča barber, pánsky strih a brada";
const SITE_DESCRIPTION =
  "Bytča barber Strojček — pánsky barbershop v Bytči. Klasický strih, fade, úprava brady, hot towel rituál. Rezervujte si termín online za 60 sekúnd.";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | Strojček Barbershop",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "barber bytca",
    "bytca barber",
    "barbershop bytca",
    "bytca barbershop",
    "strojcek bytca",
    "bytca strojcek",
    "strojcek barber bytca",
  ],
  authors: [{ name: "STROJČEK s.r.o." }],
  creator: "STROJČEK s.r.o.",
  openGraph: {
    type: "website",
    locale: "sk_SK",
    url: PUBLIC_SITE_URL,
    siteName: "Strojček Barbershop",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
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
