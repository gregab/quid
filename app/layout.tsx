import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-serif-logo",
  subsets: ["latin"],
  weight: ["400"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://aviary.gregbigelow.com"),
  title: "Aviary",
  description: "Friendly expense splitting",
  openGraph: {
    title: "Aviary",
    description: "Friendly expense splitting",
    url: "https://aviary.gregbigelow.com",
    siteName: "Aviary — Friendly Expense Splitting",
    locale: "en_US",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Aviary — Friendly Expense Splitting",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aviary",
    description: "Friendly expense splitting",
    images: [
      {
        url: "/og-image.jpg",
        alt: "Aviary — Friendly Expense Splitting",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cormorantGaramond.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
