"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

interface AuthUser {
  username: string
  lastLogin: Date
  passwordChanged: boolean
}

interface AuthContextType {
  isAuthenticated: boolean
  user: AuthUser | null
  adminPassword: string
  isLoading: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>
  resetInactivityTimer: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const INACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30 minutes
const DEFAULT_CREDENTIALS = { username: "admin", password: "admin123" }

const AUTH_STORAGE_KEY = "auth_state"
const USER_STORAGE_KEY = "auth_user"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [adminPassword, setAdminPassword] = useState(DEFAULT_CREDENTIALS.password)
  const [inactivityTimer, setInactivityTimer] = useState<NodeJS.Timeout | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load authentication state from localStorage on mount
  useEffect(() => {
    const loadAuthState = () => {
      try {
        if (typeof window !== "undefined") {
          const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY)
          const storedUser = localStorage.getItem(USER_STORAGE_KEY)
          
          if (storedAuth === "true" && storedUser) {
            try {
              const userData = JSON.parse(storedUser)
              // Convert lastLogin string back to Date
              if (userData.lastLogin) {
                userData.lastLogin = new Date(userData.lastLogin)
              }
              setUser(userData)
              setIsAuthenticated(true)
            } catch (error) {
              console.error("Error parsing stored user data:", error)
              localStorage.removeItem(AUTH_STORAGE_KEY)
              localStorage.removeItem(USER_STORAGE_KEY)
            }
          }
        }
      } catch (error) {
        console.error("Error loading auth state:", error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadAuthState()
  }, [])

  // Load password from API (uses Firebase Admin SDK)
  useEffect(() => {
    const loadPasswordFromAPI = async () => {
      try {
        const response = await fetch("/api/auth/get-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username: DEFAULT_CREDENTIALS.username }),
        })

        const data = await response.json()
        
        if (data.success) {
          setAdminPassword(data.password)
        } else {
          // Fallback to default password
          setAdminPassword(DEFAULT_CREDENTIALS.password)
        }
      } catch (error) {
        console.error("Error loading password from API:", error)
        // Fallback to default password
        setAdminPassword(DEFAULT_CREDENTIALS.password)
      }
    }
    
    loadPasswordFromAPI()
  }, [])

  const resetInactivityTimer = () => {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer)
    }

    if (isAuthenticated) {
      const timer = setTimeout(() => {
        logout()
      }, INACTIVITY_TIMEOUT)
      setInactivityTimer(timer)
    }
  }

  const login = async (username: string, password: string): Promise<boolean> => {
    // Check username first
    if (username !== DEFAULT_CREDENTIALS.username) {
      return false
    }

    try {
      // Get credentials from API (uses Firebase Admin SDK)
      const response = await fetch("/api/auth/get-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username }),
      })

      const data = await response.json()
      
      let correctPassword: string
      let passwordChanged: boolean
      
      if (data.success) {
        correctPassword = data.password || DEFAULT_CREDENTIALS.password
        passwordChanged = data.passwordChanged || false
      } else {
        // Fallback to default credentials
        correctPassword = DEFAULT_CREDENTIALS.password
        passwordChanged = false
      }
      
      // Check if provided password matches the password from database
      if (password === correctPassword) {
        // Update adminPassword state
        setAdminPassword(correctPassword)
        
        const userData: AuthUser = {
          username,
          lastLogin: new Date(),
          passwordChanged: passwordChanged,
        }

        setUser(userData)
        setIsAuthenticated(true)
        
        // Save to localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem(AUTH_STORAGE_KEY, "true")
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData))
        }
        
        resetInactivityTimer()
        return true
      }

      return false
    } catch (error) {
      console.error("Login error:", error)
      // Fallback to default password if API check fails
      if (password === DEFAULT_CREDENTIALS.password) {
        setAdminPassword(DEFAULT_CREDENTIALS.password)
        const userData: AuthUser = {
          username,
          lastLogin: new Date(),
          passwordChanged: false,
        }
        setUser(userData)
        setIsAuthenticated(true)
        
        // Save to localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem(AUTH_STORAGE_KEY, "true")
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData))
        }
        
        resetInactivityTimer()
        return true
      }
      
      return false
    }
  }

  const logout = () => {
    setIsAuthenticated(false)
    setUser(null)
    if (inactivityTimer) {
      clearTimeout(inactivityTimer)
      setInactivityTimer(null)
    }
    // Clear localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      localStorage.removeItem(USER_STORAGE_KEY)
      window.location.href = "/login"
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    try {
      const username = user?.username || DEFAULT_CREDENTIALS.username

      // Use API route (uses Firebase Admin SDK with proper permissions)
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          currentPassword,
          newPassword,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Update state
        setAdminPassword(newPassword)
        
        // Also update user data
        if (user) {
          const updatedUser = {
            ...user,
            passwordChanged: true
          }
          setUser(updatedUser)
          
          // Update localStorage
          if (typeof window !== "undefined") {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser))
          }
        }

        return true
      } else {
        console.error("Password change failed:", data.message)
        return false
      }
    } catch (error) {
      console.error("Password change error:", error)
      return false
    }
  }

  useEffect(() => {
    const handleActivity = () => {
      resetInactivityTimer()
    }

    if (isAuthenticated) {
      document.addEventListener("mousedown", handleActivity)
      document.addEventListener("keydown", handleActivity)
      document.addEventListener("scroll", handleActivity)

      return () => {
        document.removeEventListener("mousedown", handleActivity)
        document.removeEventListener("keydown", handleActivity)
        document.removeEventListener("scroll", handleActivity)
      }
    }
  }, [isAuthenticated])

  useEffect(() => {
    return () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer)
      }
    }
  }, [inactivityTimer])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        adminPassword,
        isLoading,
        login,
        logout,
        changePassword,
        resetInactivityTimer,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}


