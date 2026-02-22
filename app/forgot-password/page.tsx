"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, ArrowLeft, CheckCircle } from "lucide-react"
import Image from "next/image"

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}), // No email needed - automatically sends to admin
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess(true)
      } else {
        setError(data.message || "Failed to reset password. Please try again.")
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left Side - Forgot Password Form */}
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
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Reset Password</h2>
            <p className="text-sm sm:text-base text-gray-200">
              {success 
                ? "Password reset request sent!" 
                : "Click the button below to request a password reset."}
            </p>
          </div>

          {success ? (
            <div className="space-y-4">
              <Alert className="bg-green-900/30 border-green-500/50">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-200">
                  Password reset request sent!
                </AlertDescription>
              </Alert>
              <div className="space-y-3">
                <Button
                  onClick={() => router.push("/login")}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold"
                >
                  Back to Login
                </Button>
                <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-medium">
                  <ArrowLeft className="h-4 w-4" />
                  Return to login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
              {error && (
                <Alert variant="destructive" className="bg-red-900/30 border-red-500/50">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <AlertDescription className="text-red-200">{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl hover:shadow-blue-500/50 transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Resetting Password...
                  </div>
                ) : (
                  "Reset Password"
                )}
              </Button>

              <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-medium">
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Link>
            </form>
          )}
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
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 text-center text-white space-y-1">
          <div className="flex justify-center relative">
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

