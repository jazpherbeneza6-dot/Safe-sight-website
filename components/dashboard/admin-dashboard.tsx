"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AdminSidebar } from "./admin-sidebar"
import { SidebarInset } from "@/components/ui/sidebar"
import { DashboardHeader } from "./dashboard-header"
import { GPSTrackingView } from "./gps-tracking-view"
import { AccountManagement } from "./account-management"
import { BlindSpotLogs } from "./blind-spot-logs"
import { SecuritySettings } from "./security-settings"

export type DashboardView =
  | "gps-tracking"
  | "account-management"
  | "blind-spot-logs"
  | "security"

const DEFAULT_VIEW: DashboardView = "gps-tracking"

// Helper function to validate view
function isValidView(view: string): view is DashboardView {
  return ["gps-tracking", "account-management", "blind-spot-logs", "security"].includes(view)
}

// Helper function to get view from URL
function getViewFromURL(): DashboardView {
  if (typeof window === "undefined") return DEFAULT_VIEW
  
  const params = new URLSearchParams(window.location.search)
  const viewParam = params.get("view")
  
  if (viewParam && isValidView(viewParam)) {
    return viewParam
  }
  
  return DEFAULT_VIEW
}

export default function AdminDashboard() {
  const router = useRouter()
  const pathname = usePathname()
  const [currentView, setCurrentView] = useState<DashboardView>(DEFAULT_VIEW)
  const [isInitialized, setIsInitialized] = useState(false)

  // Load view from URL on mount and when URL changes
  useEffect(() => {
    const viewFromURL = getViewFromURL()
    setCurrentView(viewFromURL)
    setIsInitialized(true)
  }, [pathname])

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const viewFromURL = getViewFromURL()
      setCurrentView(viewFromURL)
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  // Update URL when view changes
  const handleViewChange = useCallback((view: DashboardView) => {
    setCurrentView(view)
    
    // Update URL without causing a page reload
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      params.set("view", view)
      const newUrl = `${pathname}?${params.toString()}`
      // Use replace instead of push to avoid cluttering history, or use push for back button support
      router.push(newUrl, { scroll: false })
    }
  }, [router, pathname])

  const renderCurrentView = () => {
    switch (currentView) {
      case "gps-tracking":
        return <GPSTrackingView />
      case "account-management":
        return <AccountManagement />
      case "blind-spot-logs":
        return <BlindSpotLogs />
      case "security":
        return <SecuritySettings />
      default:
        return <GPSTrackingView />
    }
  }

  return (
    <SidebarProvider>
      <AdminSidebar currentView={currentView} onViewChange={handleViewChange} />
      <SidebarInset>
        <DashboardHeader />
        <div className="flex-1 space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6 bg-background gradient-blue-mesh min-h-screen animate-fade-in relative overflow-hidden">
          <div className="absolute inset-0 gradient-blue-subtle opacity-50"></div>
          <div className="relative z-10 animate-slide-up">{renderCurrentView()}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
