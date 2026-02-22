"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Shield, Key, Clock, AlertTriangle, CheckCircle, Eye, EyeOff } from "lucide-react"

export function SecuritySettings() {
  const { user, changePassword } = useAuth()
  const { toast } = useToast()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      })
      return
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      })
      return
    }

    setIsChangingPassword(true)

    try {
      const success = await changePassword(currentPassword, newPassword)
      if (success) {
        // Password is now automatically updated in Firestore
        toast({
          title: "Success",
          description: "Password changed successfully",
          duration: 2000, // Auto-close after 2 seconds on mobile
        })
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        toast({
          title: "Error",
          description: "Current password is incorrect. Please check and try again.",
          variant: "destructive",
          duration: 3000,
        })
      }
    } catch (error: any) {
      console.error("Password change error in UI:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to change password. Please try again.",
        variant: "destructive",
        duration: 3000,
      })
    } finally {
      setIsChangingPassword(false)
    }
  }

  const securityFeatures = [
    {
      title: "Auto-logout on Inactivity",
      description: "Automatically logs out after 30 minutes of inactivity",
      status: "active",
      icon: Clock,
    },
    {
      title: "Password Protection",
      description: "Secure password-based authentication",
      status: "active",
      icon: Key,
    },
    {
      title: "Session Management",
      description: "Secure session handling and validation",
      status: "active",
      icon: Shield,
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Security Settings</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Manage your account security and authentication settings</p>
      </div>

      {/* Account Status */}
      <Card>
        <CardHeader className="pb-3 p-4 sm:p-6 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
            Account Status
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-1">Current security status of your admin account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
          <div className="flex items-center justify-between p-3 sm:p-4 bg-black rounded-lg border border-green-200">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-white text-sm sm:text-base">Account Secure</p>
                <p className="text-xs sm:text-sm text-white">All security features are active</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2 text-xs sm:text-sm py-1">
              <span className="text-muted-foreground">Username:</span>
              <span className="font-medium truncate">{user?.username}</span>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2 text-xs sm:text-sm py-1">
              <span className="text-muted-foreground">Last Login:</span>
              <span className="font-medium text-xs sm:text-sm truncate">{user?.lastLogin?.toLocaleString()}</span>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2 text-xs sm:text-sm py-1">
              <span className="text-muted-foreground">Password Changed:</span>
              <span className="font-medium text-xs sm:text-sm truncate">{user?.passwordChanged ? "Yes" : "Using default password"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card>
        <CardHeader className="pb-3 p-4 sm:p-6 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Key className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
            Change Password
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-1">Update your admin password for enhanced security</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          {!user?.passwordChanged && (
            <Alert className="mb-4 sm:mb-5">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You are still using the default password. It's recommended to change it for better security.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-sm sm:text-base">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="h-10 sm:h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm sm:text-base">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  className="h-10 sm:h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm sm:text-base">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  className="h-10 sm:h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={isChangingPassword} className="w-full sm:w-auto h-10 sm:h-11">
              {isChangingPassword ? "Changing Password..." : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Security Features */}
      <Card>
        <CardHeader className="pb-3 p-4 sm:p-6 sm:pb-4">
          <CardTitle className="text-lg sm:text-xl">Security Features</CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-1">Active security measures protecting your admin account</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          <div className="space-y-3">
            {securityFeatures.map((feature) => (
              <div key={feature.title} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 p-3 sm:p-4 border rounded-lg">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <feature.icon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm sm:text-base">{feature.title}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-xs sm:text-sm text-green-600 font-medium">Active</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Tips */}
      <Card>
        <CardHeader className="pb-3 p-4 sm:p-6 sm:pb-4">
          <CardTitle className="text-lg sm:text-xl">Security Best Practices</CardTitle>
          <CardDescription className="text-xs sm:text-sm mt-1">Follow these recommendations to keep your account secure</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          <div className="space-y-3 text-xs sm:text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <span>Use a strong, unique password with at least 8 characters</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <span>Change your password regularly (every 90 days recommended)</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <span>Always log out when finished using the system</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <span>Don't share your login credentials with others</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <span>Use the system from secure, trusted devices only</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
     
