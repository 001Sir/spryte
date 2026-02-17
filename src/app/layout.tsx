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
  metadataBase: new URL("https://sprytegames.com"),
  title: {
    default: "Spryte Games — Free Browser Games | Play Instantly Online",
    template: "%s | Spryte Games",
  },
  description:
    "Play free browser games instantly on Spryte Games. No downloads, no installs — just fun. Action, puzzle, racing, arcade & strategy games playable on any device.",
  keywords: [
    "free browser games",
    "online games",
    "play games online",
    "HTML5 games",
    "no download games",
    "free games",
    "Spryte Games",
    "instant play games",
    "browser gaming",
    "action games",
    "puzzle games",
    "arcade games",
  ],
  authors: [{ name: "Spryte Games", url: "https://sprytegames.com" }],
  creator: "Spryte Games",
  publisher: "Spryte Games",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "Spryte Games — Free Browser Games | Play Instantly Online",
    description:
      "Play free browser games instantly. No downloads, no installs — just fun. Action, puzzle, racing, arcade & strategy games.",
    url: "https://sprytegames.com",
    siteName: "Spryte Games",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Spryte Games — Free Browser Games",
    description:
      "Play free browser games instantly. No downloads, no installs — just fun.",
    site: "@SpriteGames",
  },
  alternates: {
    canonical: "https://sprytegames.com",
  },
  manifest: "/manifest.json",
  category: "games",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="canonical" href="https://sprytegames.com" />
        <meta name="theme-color" content="#e94560" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Spryte Games" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <a href="#main-content" className="skip-nav">
          Skip to content
        </a>
        <Navbar />
        <main id="main-content" className="animate-fade-in">{children}</main>
        <Footer />
        <ScrollToTop />
      </body>
    </html>
  );
}
