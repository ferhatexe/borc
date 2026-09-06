import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { getCurrentSession } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { PwaRegister } from "@/components/shared/PwaRegister";
import { LiveDataProvider } from "@/components/live/LiveDataProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeScript } from "@/components/theme/ThemeScript";
import { AuroraBackground } from "@/components/shared/AuroraBackground";
import { PageTransition } from "@/components/layout/PageTransition";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
    statusBarStyle: "black-translucent",
    title: "BorçÖlçme",
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f6f7",
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
    /*
     * `suppressHydrationWarning`: ThemeScript `data-theme`i sunucu HTML'inde
     * olmayan bir değere ayarlıyor. Kasıtlı - yoksa açık temayı seçen kullanıcı
     * her yüklemede bir kare koyu ekran görür.
     */
    <html lang="tr" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body
        className={`${inter.className} min-h-[100dvh] bg-background text-foreground antialiased`}
      >
        {/* WCAG Erişilebilirlik: İçeriğe Atla Bağlantısı */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-lg focus:font-semibold focus:shadow-xl focus:outline-none"
        >
          Ana İçeriğe Atla
        </a>

        <ThemeProvider>
        <AuroraBackground />
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
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: "#18181B",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#F4F4F5",
            },
          }}
        />
      </body>
    </html>
  );
}
