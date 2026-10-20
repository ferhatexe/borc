import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { getCurrentSession } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { PwaRegister } from "@/components/shared/PwaRegister";
import { LiveDataProvider } from "@/components/live/LiveDataProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { DotField } from "@/components/shared/DotField";
import { PageTransition } from "@/components/layout/PageTransition";
import "./globals.css";

// Geist: GT Standard'a görsel olarak en yakın ücretsiz grotesk. Mono, rakam
// sütunlarının hizasını korumak için (font-mono / tabular-nums kullanan her yer).
const geist = Geist({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist",
  display: "swap",
});
const geistMono = Geist_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Borç & Nakit Takip | Kişisel Finans Kasası",
  description:
    "Kişisel borç, kredi kartı, taksitli kredi, KMH ve altın borçlarınızı canlı kurlarla takip edin.",
  manifest: "/manifest.json",
  applicationName: "BorçÖlçme",
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/icon-180x180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BorçÖlçme",
  },
};

export const viewport: Viewport = {
  themeColor: "#fafafa",
  width: "device-width",
  initialScale: 1,
  // Yakınlaştırma engellenmez (WCAG 2.1 - 1.4.4). Eski ayar
  // maximumScale: 1 / userScalable: false az goren kullanicilar icin erisilebilirlik ihlaliydi.
  maximumScale: 5,
  userScalable: true,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCurrentSession();

  return (
    /* Uygulama yalnız açık temada çalışır. */
    <html lang="tr" data-theme="light">
      <body
        className={`${geist.variable} ${geistMono.variable} font-sans min-h-[100dvh] bg-background text-foreground antialiased`}
      >
        {/* WCAG Erişilebilirlik: İçeriğe Atla Bağlantısı */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-foreground focus:text-background focus:rounded-full focus:font-semibold focus:shadow-xl focus:outline-none"
        >
          Ana İçeriğe Atla
        </a>

        <ThemeProvider>
        <DotField />
        <LiveDataProvider isAuthenticated={Boolean(session)}>
          {/* Hareketli zemin arkada (z-0); arayüz onun üstünde durmalı. */}
          <div className="relative z-10 flex min-h-[100dvh] flex-col">
            <PwaRegister />
            {session && <Navbar userEmail={session.email} />}

            <div className="flex flex-1">
              {session && <Sidebar />}
              <main
                id="main-content"
                tabIndex={-1}
                role="main"
                /* Alt gezinme çubuğu + iOS home indicator için mobilde ekstra boşluk */
                className={
                  session
                    ? /* Alt gezinme + iOS home indicator icin mobilde ekstra bosluk */
                      "mx-auto w-full max-w-7xl flex-1 overflow-x-hidden px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] pt-4 focus:outline-none sm:px-4 md:px-8 md:pb-10 md:pt-8"
                    : "flex w-full flex-1 flex-col focus:outline-none"
                }
              >
                <PageTransition>{children}</PageTransition>
              </main>
            </div>

            {session && <MobileNav />}
          </div>
        </LiveDataProvider>
        </ThemeProvider>

        <Toaster
          position="top-right"
          toastOptions={{
            // Temayla birlikte döner; eskiden açık temada da siyah kutuydu.
            style: {
              background: "var(--card)",
              border: "1px solid var(--line)",
              color: "var(--foreground)",
              borderRadius: "16px",
            },
          }}
        />
      </body>
    </html>
  );
}
