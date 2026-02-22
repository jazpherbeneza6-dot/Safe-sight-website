"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertTriangle, Eye, EyeOff, Lock, User } from "lucide-react"
import "@/app/login-animations.css"

export default function SplitScreenAuth() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const {login, isAuthenticated} = useAuth()
  const router = useRouter()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([])

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/")
    }
  }, [isAuthenticated, router])

  const handleRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = buttonRef.current
    if (!button) return

    const rect = button.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const newRipple = {
      x,
      y,
      id: Date.now()
    }

    setRipples(prev => [...prev, newRipple])

    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id))
    }, 600)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const success = await login(username, password)
      if (success) {
        // Redirect to home page after successful login
        router.push("/")
      } else {
        setError("Invalid username or password")
      }  
    } catch (err) {
      setError("Login failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left Side - Login Form */}
      <div 
        className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 relative overflow-hidden min-h-[50vh] md:min-h-screen"
        style={{
          backgroundImage: 'url(/Background-2.png)',
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/40"></div>
        
        <div className="w-full max-w-md space-y-6 sm:space-y-8 relative z-10 px-4 sm:px-0">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Sign In</h2>
            <p className="text-sm sm:text-base text-gray-200">Welcome back! Please sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-200 font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-gray-300" />
                Email
              </Label>
              <Input
                id="username"
                type="text"
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your email"
                required
                className="h-12 text-white bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg shadow-[0_0_15px_rgba(255,255,255,0.1)] focus:border-white/40 focus:shadow-[0_0_20px_rgba(255,255,255,0.2)] focus:ring-0 placeholder:text-gray-400 transition-all duration-300"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-200 font-medium flex items-center gap-2">
                <Lock className="h-4 w-4 text-gray-300" />
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="h-12 text-white bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg shadow-[0_0_15px_rgba(255,255,255,0.1)] focus:border-white/40 focus:shadow-[0_0_20px_rgba(255,255,255,0.2)] focus:ring-0 placeholder:text-gray-400 pr-12 transition-all duration-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-300 hover:text-white transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <Link href="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300 font-medium">
                Forgot your password?
              </Link>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive" className="bg-red-900/30 border-red-500/50">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-200">{error}</AlertDescription>
              </Alert>
            )}

            {/* Sign In Button */}
            <Button
              ref={buttonRef}
              type="submit"
              onClick={handleRipple}
              className="relative w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl hover:shadow-blue-500/50 transition-all duration-300 overflow-hidden"
              disabled={isLoading}
            >
              {/* Ripple effects */}
              {ripples.map((ripple) => (
                <span
                  key={ripple.id}
                  className="absolute rounded-full bg-white/30 animate-ripple"
                  style={{
                    left: `${ripple.x}px`,
                    top: `${ripple.y}px`,
                    width: '20px',
                    height: '20px',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              ))}
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Signing in...
                </div>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Right Side - Branding */}
      <div 
        className="hidden md:flex flex-1 items-start justify-center pt-20 px-8 pb-8 relative overflow-hidden"
        style={{
          backgroundImage: 'url(/Background-1.png)',
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/20"></div>

        {/* Animated Background Elements */}
        {/* Blinking Dots */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
        <div className="absolute top-1/3 right-1/3 w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
        <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-cyan-300 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-1/3 right-1/4 w-2 h-2 bg-blue-300 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }}></div>

        <div className="relative z-10 text-center text-white space-y-1">
          {/* Logo with Gradient Overlay */}
          <div className="flex justify-center relative">
            {/* Radial Gradient Behind Logo */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="radial-gradient-glow"></div>
            </div>
            <Image
              src="/logo-1.png"
              alt="Safesight Logo"
              width={400}
              height={400}
              className="relative z-10 w-[200px] h-[200px] sm:w-[300px] sm:h-[300px] md:w-[400px] md:h-[400px]"
            />
          </div>

          {/* Welcome Message */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold">Safesight</h1>
            <p className="text-xl opacity-90 font-medium">Advanced Admin Blindspot System</p>
            <p className="text-lg opacity-80 max-w-md mx-auto leading-relaxed">
              Secure administrative portal for comprehensive Safe-Sight monitoring and management
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
