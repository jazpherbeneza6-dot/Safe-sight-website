"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { MapPin, Users, AlertTriangle, Settings, Shield } from "lucide-react"
import type { DashboardView } from "./admin-dashboard"

interface AdminSidebarProps {
  currentView: DashboardView
  onViewChange: (view: DashboardView) => void
}

const navigationItems = [
  {
    title: "GPS Tracking",
    icon: MapPin,
    view: "gps-tracking" as DashboardView,
  },
  {
    title: "Account Management",
    icon: Users,
    view: "account-management" as DashboardView,
  },
  {
    title: "Blind Spot Logs",
    icon: AlertTriangle,
    view: "blind-spot-logs" as DashboardView,
  },
  {
    title: "Security Settings",
    icon: Settings,
    view: "security" as DashboardView,
  },
]

export function AdminSidebar({ currentView, onViewChange }: AdminSidebarProps) {

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar/95 backdrop-blur-sm">
      <SidebarHeader className="border-b border-sidebar-border/50">
        <div className="flex items-center gap-4 px-4 py-">
          <div className="relative">
            <img src="/safesight_logo.jpg" alt="Safesight Logo" className="w-40 h-12 object-contain" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold bg-gradient-to-r from-sidebar-foreground to-sidebar-foreground/80 bg-clip-text text-transparent">
              SafeSight PRO
            </h2>
            <p className="text-sm text-sidebar-foreground/60 font-medium">Advanced Fleet Management</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider px-3 mb-2">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.view}>
                  <SidebarMenuButton
                    onClick={() => onViewChange(item.view)}
                    isActive={currentView === item.view}
                    className={`
                      group relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200
                      ${currentView === item.view
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-lg shadow-sidebar-accent/20"
                        : "hover:bg-sidebar-primary/50 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                      }
                    `}
                  >
                    <div
                      className={`
                      p-2 rounded-lg transition-colors duration-200
                      ${currentView === item.view
                          ? "bg-white/20"
                          : "bg-sidebar-primary/30 group-hover:bg-sidebar-primary/50"
                        }
                    `}
                    >
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span className="font-medium">{item.title}</span>
                    {currentView === item.view && (
                      <div className="absolute right-2 w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
