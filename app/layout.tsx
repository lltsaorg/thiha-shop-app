import type React from "react"
import { Montserrat, Open_Sans } from "next/font/google"
import "./globals.css"
import GlobalLoadingOverlay from "@/components/GlobalLoadingOverlay";
import { SelectedItemsProvider } from "@/components/SelectedItemsProvider";

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
  weight: ["400", "600", "700", "900"],
})

const openSans = Open_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-open-sans",
  weight: ["400", "500", "600"],
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Expose user fallback max age (seconds) to client without adding NEXT_PUBLIC env
  const envMax = Number(process.env.APP_USER_MAX_AGE_SEC);
  const fallbackMaxAgeSec = Number.isFinite(envMax) && envMax > 0 ? Math.floor(envMax) : 60 * 60 * 24 * 7;
  return (
    <html lang="ja" className={`${montserrat.variable} ${openSans.variable} antialiased`}>
      <body className="font-sans">
        {/* Inject a global for client-side fallback age alignment */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__THIHA_FALLBACK_MAX_AGE__=${fallbackMaxAgeSec};`,
          }}
        />
        <SelectedItemsProvider>
          {children}
          <GlobalLoadingOverlay />
        </SelectedItemsProvider>
      </body>
    </html>
  )
}

export const metadata = {
      generator: 'v0.app'
    };
