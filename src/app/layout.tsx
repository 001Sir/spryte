import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ScrollToTop from "@/components/layout/ScrollToTop";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Spryte Games — Free Browser Games",
  description: "Play free browser games instantly. No downloads, no installs — just fun.",
  metadataBase: new URL("https://spryte.games"),
  openGraph: {
    title: "Spryte Games — Free Browser Games",
    description: "Play free browser games instantly. No downloads, no installs — just fun.",
    siteName: "Spryte Games",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Spryte Games — Free Browser Games",
    description: "Play free browser games instantly. No downloads, no installs — just fun.",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <Navbar />
        <main className="animate-fade-in">{children}</main>
        <Footer />
        <ScrollToTop />
      </body>
    </html>
  );
}
