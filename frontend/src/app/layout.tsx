import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import LayoutWrapper from "@/components/layout/LayoutWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OrbitalAid | Aerospace Software — Mission Control & SSA",
  description: "Advanced Space Situational Awareness & Orbital Conjunction Operations C2 System",
  icons: {
    icon: [
      { url: "/logo.png" },
      { url: "/icon.png" },
      { url: "/favicon.ico" },
    ],
    shortcut: ["/logo.png"],
    apple: [
      { url: "/logo.png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className="min-h-full bg-[var(--bg-space)] text-[var(--text-primary)]">
        <LayoutWrapper>
          {children}
        </LayoutWrapper>
      </body>
    </html>
  );
}