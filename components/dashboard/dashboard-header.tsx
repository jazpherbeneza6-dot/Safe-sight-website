"use client"

import Image from "next/image"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/contexts/auth-context"
import { LogOut } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function DashboardHeader() {
  const { user, logout } = useAuth()

  return (
    <header className="flex h-16 md:h-20 shrink-0 items-center gap-2 md:gap-4 border-b border-border/50 glass-effect px-3 sm:px-4 md:px-6 shadow-sm">
      <SidebarTrigger className="-ml-1 p-2 hover:bg-muted/50 rounded-xl transition-all duration-200 hover:scale-105" />
      <Separator orientation="vertical" className="hidden sm:block mr-2 h-8 bg-border/50" />



      <div className="flex items-center gap-3 md:gap-6 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent truncate">
            Safe-Sight Admin System
          </h1>
          <p className="hidden sm:block text-xs md:text-sm text-muted-foreground font-medium truncate">Real-time fleet monitoring and control center</p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative cursor-pointer hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center overflow-hidden shadow-lg ring-2 ring-background">
                <Image
                  src="/logo-1.png"
                  alt="SafeSight Logo"
                  width={48}
                  height={48}
                  className="object-contain w-full h-full"
                />
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={logout}
              variant="destructive"
              className="cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
