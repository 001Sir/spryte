import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ScrollToTop from "@/components/layout/ScrollToTop";
import Particles from "@/components/layout/Particles";
import PageTransition from "@/components/layout/PageTransition";
import AchievementProvider from "@/components/providers/AchievementProvider";
import OfflineIndicator from "@/components/ui/OfflineIndicator";
import PwaPrompt from "@/components/layout/PwaPrompt";
import { SwRegistration } from "@/components/providers/SwRegistration";

const inter = Inter({
  variable: "--font-inter",
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
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Spryte Games — Free Browser Games",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Spryte Games — Free Browser Games",
    description:
      "Play free browser games instantly. No downloads, no installs — just fun.",
    site: "@SpryteGames",
    images: ["/og-image.png"],
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
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#06050e" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Spryte Games" />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <noscript>
          <div style={{ padding: '2rem', textAlign: 'center', background: '#06050e', color: '#eeedf5' }}>
            <h1>Spryte Games — Free Browser Games</h1>
            <p>Play free browser games instantly. Please enable JavaScript to play our games.</p>
          </div>
        </noscript>
        <a href="#main-content" className="skip-nav">
          Skip to content
        </a>
        <AchievementProvider>
        <Particles />
        <OfflineIndicator />
        <Navbar />
        <main id="main-content" className="relative z-10">
          <PageTransition>{children}</PageTransition>
        </main>
        <Footer />
        <ScrollToTop />
        <PwaPrompt />
        <SwRegistration />
        </AchievementProvider>
      </body>
    </html>
  );
}
