import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Nunito } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ResizeObserverErrorSuppressor } from "@/components/resize-observer-error-suppressor"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })
const _nunito = Nunito({ subsets: ["latin"], weight: ["300", "400", "600", "700"] })

export const metadata: Metadata = {
  title: "El Mundo de las Tutus",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <ResizeObserverErrorSuppressor />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
