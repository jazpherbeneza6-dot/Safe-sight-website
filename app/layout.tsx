import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import "@/styles/compatibility.css"
import { AuthProvider } from "@/contexts/auth-context"
import { AdminProvider } from "@/contexts/admin-context"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Safe-Sight Admin System",
  description: "Advanced Safe-Sight admin management and monitoring system",
  icons: {
    icon: "/logo-1.png",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          <AdminProvider>
            {children}
            <Toaster />
          </AdminProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
