"use client"
import { Eye, EyeOff } from "lucide-react"
import { useState, useEffect } from "react"
import Image from "next/image"
import { compressImage, formatFileSize } from "@/lib/image-utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAdmin, type TruckDriver } from "@/contexts/admin-context"
import { alerts } from "@/lib/alerts"
import {
  Plus,
  Edit,
  Trash2,
  User,
  Phone,
  Mail,
  CreditCard,
  Cloud,
  Loader2,
  AlertTriangle,
  Users,
  Shield,
  Upload,
} from "lucide-react"

import { FirebaseSetupGuide } from "@/components/setup/firebase-setup-guide"
import { useAuth } from "@/contexts/auth-context"
import { auth } from "@/firebase"
import { createUserWithEmailAndPassword } from "firebase/auth"

export function AccountManagement() {
  const { adminPassword } = useAuth()
  const { truckDrivers, addTruckDriver, updateTruckDriver, deleteTruckDriver, isLoading } = useAdmin()
  const [showAddLicense, setShowAddLicense] = useState(false)
  const [showAddTruckDriver, setShowAddTruckDriver] = useState(false)
  const [showEditLicense, setShowEditLicense] = useState(false)
  const [verifyLicensePassword, setVerifyLicensePassword] = useState(false)
  const [verifyUpdatePassword, setVerifyUpdatePassword] = useState(false)
  const [passwordInput, setPasswordInput] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState<TruckDriver | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fullName: "",
    licenseNumber: "",
    phoneNumber: "",
    email: "",
    status: "active" as "active" | "inactive" | "online" | "offline",
    profileImageUrl: "",
  })
  const [showSetupGuide, setShowSetupGuide] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      fullName: "",
      licenseNumber: "",
      phoneNumber: "",
      email: "",
      status: "active" as "active" | "inactive" | "online" | "offline",
      profileImageUrl: "",
    })
    setSelectedFile(null)
  }

  const handleAddDriver = async () => {
    // Validate required fields with detailed feedback
    const missingFields: string[] = []
    if (!formData.username?.trim()) missingFields.push("Username")
    if (!formData.password?.trim()) missingFields.push("Password")
    if (!formData.fullName?.trim()) missingFields.push("Full Name")
    if (!formData.email?.trim()) missingFields.push("Email")

    if (missingFields.length > 0) {
      alerts.error("Missing required fields", {
        details: `Please fill in: ${missingFields.join(", ")}`
      })
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      alerts.error("Invalid email format", {
        details: "Please enter a valid email address (e.g., driver@example.com)"
      })
      return
    }

    // Validate password length
    if (formData.password.length < 6) {
      alerts.error("Password too short", {
        details: "Password must be at least 6 characters long"
      })
      return
    }

    if (!adminPassword) {
      alerts.error("Admin privileges required", {
        details: "You must be an admin to create new driver accounts",
      })
      return
    }

    // Check if email already exists in the drivers list
    const emailExists = truckDrivers.some(
      driver => driver.email?.toLowerCase() === formData.email.toLowerCase()
    )

    if (emailExists) {
      alerts.error("Email already exists", {
        details: `The email "${formData.email}" is already registered to another driver. Please use a different email address.`
      })
      return
    }

    setIsSubmitting(true)

    try {
      console.log("Creating Firebase Auth user...", { email: formData.email })

      // Use Firebase Client SDK directly instead of API route
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      )

      console.log("Firebase Auth user created successfully:", userCredential.user.uid)

      const firebaseUid = userCredential.user.uid

      let profileImageUrl = ""
      if (selectedFile) {
        setUploading(true)
        try {
          // Compress image before upload to reduce file size and speed up upload
          const originalSize = selectedFile.size
          const compressedFile = await compressImage(selectedFile, 800, 800, 0.85)
          const compressedSize = compressedFile.size
          const savedBytes = originalSize - compressedSize

          console.log(`Image compressed: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (saved ${formatFileSize(savedBytes)})`)

          const uploadFormData = new FormData()
          uploadFormData.append("file", compressedFile)

          const res = await fetch("/api/upload-mega", {
            method: "POST",
            body: uploadFormData,
          })
          const data = await res.json()

          // Handle upload failure gracefully - don't throw, just log and continue
          if (!res.ok) {
            const errorMsg = data.error || "Upload failed"
            console.warn("Profile picture upload failed:", errorMsg)

            // Check if it's a blocking error
            if (errorMsg.includes("EBLOCKED") || errorMsg.includes("User blocked")) {
              alerts.warning("Profile picture upload skipped", {
                details: "The image upload service is currently unavailable. The driver account will be created without a profile picture. You can add one later by editing the driver."
              })
            } else {
              alerts.warning("Profile picture upload failed", {
                details: `Could not upload profile picture: ${errorMsg}. The driver account will be created without a profile picture. You can add one later.`
              })
            }
            // Continue with driver creation even if upload fails
            profileImageUrl = ""
          } else {
            profileImageUrl = data.url
            console.log("Profile picture uploaded successfully:", profileImageUrl)
          }
        } catch (error: any) {
          console.warn("Upload error (non-critical):", error)
          // Don't block driver creation if upload fails - make it optional
          const errorMsg = error.message || "Unknown error"

          // Check if it's a blocking error
          if (errorMsg.includes("EBLOCKED") || errorMsg.includes("User blocked")) {
            alerts.warning("Profile picture upload skipped", {
              details: "The image upload service is currently unavailable. The driver account will be created without a profile picture. You can add one later by editing the driver."
            })
          } else {
            alerts.warning("Profile picture upload failed", {
              details: `Could not upload profile picture: ${errorMsg}. The driver account will be created without a profile picture. You can add one later.`
            })
          }
          // Continue with driver creation even if upload fails
          profileImageUrl = ""
        } finally {
          setUploading(false)
        }
      }

      console.log("Adding driver to Firestore...", {
        username: formData.username,
        fullName: formData.fullName,
        email: formData.email,
        firebaseUid: firebaseUid
      })

      // Add driver to Firestore
      await addTruckDriver({
        ...formData,
        firebaseUid: firebaseUid,
        profileImageUrl,
      })

      console.log("Driver added to Firestore successfully!")

      alerts.success("Driver account created successfully!", {
        details: `${formData.fullName} has been added to the system.`
      })

      resetForm()
      setIsAddDialogOpen(false)
      setShowSetupGuide(false)
    } catch (error: any) {
      console.error("Error creating driver account:", error)
      console.error("Error code:", error.code)
      console.error("Error message:", error.message)
      console.error("Full error:", JSON.stringify(error, null, 2))

      // Handle Firebase errors with better user feedback
      let errorMessage = "Failed to create driver account"
      let errorDetails: string | undefined

      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Email address is already in use"
        errorDetails = `The email "${formData.email}" is already registered in Firebase Authentication. Please use a different email address.`
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address"
        errorDetails = "Please enter a valid email address format (e.g., user@example.com)"
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak"
        errorDetails = "Password must be at least 6 characters long"
      } else if (error.code === "auth/operation-not-allowed") {
        errorMessage = "Email/Password authentication is not enabled"
        errorDetails = "Please enable Email/Password authentication in Firebase Console → Authentication → Sign-in method"
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error"
        errorDetails = "Please check your internet connection and try again"
      } else if (error.code === "permission-denied" || error.code === "PERMISSION_DENIED") {
        setShowSetupGuide(true)
        errorMessage = "Firebase permissions error"
        errorDetails = "Please follow the setup guide to configure Firebase security rules. The app will show the setup guide now."
      } else if (error.message?.includes("Missing or insufficient permissions") ||
        error.message?.includes("PERMISSION_DENIED")) {
        setShowSetupGuide(true)
        errorMessage = "Firebase permissions error"
        errorDetails = "Please follow the setup guide to configure Firebase security rules. The app will show the setup guide now."
      } else if (error.message) {
        errorMessage = error.message
        errorDetails = "Please check the browser console for more details or contact support."
      }

      alerts.error(errorMessage, {
        details: errorDetails
      })
    } finally {
      setIsSubmitting(false)
      setUploading(false)
    }
  }

  const handleEditDriver = async () => {
    if (!editingDriver || !formData.username || !formData.fullName || !formData.email) {
      alerts.error("Please fill in all required fields")
      return
    }

    setIsSubmitting(true)

    try {
      let updateData = { ...formData }

      // Handle profile picture upload if changed
      if (selectedFile) {
        setUploading(true)

        // Delete old profile picture if exists
        if (editingDriver.profileImageUrl) {
          try {
            await fetch("/api/delete-mega", {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ url: editingDriver.profileImageUrl }),
            })
            console.log("Old profile picture deleted successfully")
          } catch (error: any) {
            console.warn("Could not delete old profile picture:", error)
            // Continue anyway - upload is more important
          }
        }

        // Compress image before upload to reduce file size and speed up upload
        const originalSize = selectedFile.size
        const compressedFile = await compressImage(selectedFile, 800, 800, 0.85)
        const compressedSize = compressedFile.size
        const savedBytes = originalSize - compressedSize

        console.log(`Image compressed: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (saved ${formatFileSize(savedBytes)})`)

        // Upload new profile picture
        const uploadFormData = new FormData()
        uploadFormData.append("file", compressedFile)

        try {
          const res = await fetch("/api/upload-mega", {
            method: "POST",
            body: uploadFormData,
          })
          const data = await res.json()

          // Handle upload failure gracefully - don't throw, just log and continue
          if (!res.ok) {
            const errorMsg = data.error || "Upload failed"
            console.warn("Profile picture update failed:", errorMsg)

            // Check if it's a blocking error
            if (errorMsg.includes("EBLOCKED") || errorMsg.includes("User blocked")) {
              alerts.warning("Profile picture update skipped", {
                details: "The image upload service is currently unavailable. The driver information will be updated without changing the profile picture."
              })
            } else {
              alerts.warning("Profile picture update failed", {
                details: `Could not update profile picture: ${errorMsg}. The driver information will be updated without changing the profile picture.`
              })
            }
            // Keep the old profile image URL
            updateData.profileImageUrl = editingDriver.profileImageUrl || ""
          } else {
            // Set new profile image URL
            updateData.profileImageUrl = data.url
            console.log("Profile picture updated successfully:", data.url)
          }
        } catch (error: any) {
          console.warn("Upload error (non-critical):", error)
          const errorMsg = error.message || "Unknown error"

          // Check if it's a blocking error
          if (errorMsg.includes("EBLOCKED") || errorMsg.includes("User blocked")) {
            alerts.warning("Profile picture update skipped", {
              details: "The image upload service is currently unavailable. The driver information will be updated without changing the profile picture."
            })
            // Keep the old profile image URL
            updateData.profileImageUrl = editingDriver.profileImageUrl || ""
          } else {
            alerts.warning("Profile picture update failed", {
              details: `Could not update profile picture: ${errorMsg}. The driver information will be updated without changing the profile picture.`
            })
            // Keep the old profile image URL
            updateData.profileImageUrl = editingDriver.profileImageUrl || ""
          }
          // Continue with update even if upload fails
        } finally {
          setUploading(false)
        }
      }

      // Update the driver's information in Firestore
      await updateTruckDriver(editingDriver.id, updateData)

      alerts.success("Driver account updated successfully!", {
        details: `Updated ${formData.fullName}'s account in Firestore database`,
        duration: 2000, // Auto-close after 2 seconds on mobile
      })

      resetForm()
      setIsEditDialogOpen(false)
      setEditingDriver(null)
    } catch (error: any) {
      alerts.error(error.message || "Failed to update driver account", {
        title: "Update Error",
        details: "There was a problem updating the driver information in Firestore"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteDriver = async (driver: TruckDriver) => {
    try {
      // Check if admin password is required for deletion
      if (!adminPassword) {
        alerts.error("Admin privileges required", {
          details: "You must be an admin to delete driver accounts",
        })
        return
      }

      // Delete from Firestore (Firebase Auth user deletion requires Admin SDK/Cloud Functions)
      // Note: Firebase Auth user will remain but won't have access to the app
      await deleteTruckDriver(driver.id)

      alerts.success("Driver account deleted successfully", {
        details: `${driver.fullName}'s account has been removed from the database. Note: Firebase Auth user may still exist and can be deleted manually from Firebase Console if needed.`,
      })
    } catch (error: any) {
      alerts.error(error.message || "Failed to delete driver account")
    }
  }

  const openEditDialog = (driver: TruckDriver) => {
    setEditingDriver(driver)
    setFormData({
      username: driver.username,
      password: driver.password,
      fullName: driver.fullName,
      licenseNumber: driver.licenseNumber,
      phoneNumber: driver.phoneNumber,
      email: driver.email,
      status: driver.status,
      profileImageUrl: driver.profileImageUrl || "",
    })
    setIsEditDialogOpen(true)
  }

  const verifyAdminPassword = (inputPassword: string, type: "license" | "update") => {
    if (inputPassword === adminPassword) {
      if (type === "license") {
        setShowEditLicense(true)
        setVerifyLicensePassword(false)
      } else {
        handleEditDriver()
        setVerifyUpdatePassword(false)
      }
      setPasswordInput("")
      setPasswordError("")
    } else {
      setPasswordError("Incorrect admin password")
    }
  }

  useEffect(() => {
    if (showEditLicense) {
      setShowEditLicense(false)
    }
  }, [adminPassword])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-chart-1 to-chart-2 rounded-xl shadow-lg">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">Loading drivers from Firestore...</p>
            <p className="text-sm text-muted-foreground">Connecting to cloud database</p>
          </div>
        </div>
      </div>
    )
  }

  if (showSetupGuide) {
    return <FirebaseSetupGuide />
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 bg-muted/50 backdrop-blur-sm px-4 py-2 rounded-xl border border-border/50">
          <div className="w-2 h-2 bg-chart-1 rounded-full animate-pulse"></div>
          <span className="text-xs font-medium text-muted-foreground">Driver Management System</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground via-chart-1 to-chart-2 bg-clip-text text-transparent">
          Account Management
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto px-4">
          Manage driver accounts, credentials, and access permissions with advanced security controls
        </p>
      </div>

      <Card className="border-0 shadow-lg bg-gradient-to-br from-chart-1/5 via-chart-2/5 to-chart-1/5 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 flex-1">
              <div className="relative">
                <div className="bg-muted/80 dark:bg-muted p-3 rounded-xl shadow-lg flex items-center justify-center border border-border/50">
                  <Image
                    src="/driver_logo.png"
                    alt="Driver Logo"
                    width={48}
                    height={48}
                    className="object-contain"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">Create Driver Account</h3>
                <p className="text-sm text-muted-foreground">Add new drivers to your fleet management system</p>
                <div className="flex items-center gap-3 text-xs">
                  <Badge variant="outline" className="bg-chart-4/10 text-chart-4 border-chart-4/20 text-xs px-2 py-0.5">
                    <Cloud className="h-2.5 w-2.5 mr-1" />
                    Cloud Sync
                  </Badge>
                  <Badge variant="outline" className="bg-chart-2/10 text-chart-2 border-chart-2/20 text-xs px-2 py-0.5">
                    <Shield className="h-2.5 w-2.5 mr-1" />
                    Secure
                  </Badge>
                </div>
              </div>
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={resetForm}
                  aria-label="Add new driver"
                  className="bg-gradient-to-r from-chart-1 to-chart-2 hover:from-chart-1/90 hover:to-chart-2/90 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                  Add Driver
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:max-w-[450px] border-0 shadow-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="space-y-2 sm:space-y-3 pb-3 sm:pb-4 px-4 sm:px-6 pt-4 sm:pt-6">
                  <div className="flex flex-col items-center gap-4">
                    {/* Profile Picture Upload Section */}
                    <div className="flex flex-col items-center gap-3 w-full">
                      <div className="relative">
                        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-chart-1/20 shadow-lg bg-muted/80">
                          <Image
                            src={selectedFile ? URL.createObjectURL(selectedFile) : "/driver_logo.png"}
                            alt="Profile Picture"
                            width={128}
                            height={128}
                            className="object-cover w-full h-full"
                          />
                        </div>
                        {selectedFile && (
                          <button
                            type="button"
                            aria-label="Remove photo"
                            onClick={() => setSelectedFile(null)}
                            className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1.5 shadow-lg hover:bg-destructive/90 transition-all"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col items-center gap-2">
                        <label htmlFor="profile-upload" className="cursor-pointer">
                          <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-chart-1 to-chart-2 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
                            <Upload className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {selectedFile ? "Change Photo" : "Upload Photo"}
                            </span>
                          </div>
                        </label>
                        <input
                          id="profile-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              const file = e.target.files[0]
                              // Validate file size (max 10MB before compression)
                              if (file.size > 10 * 1024 * 1024) {
                                alerts.error("File too large", {
                                  details: `File size is ${formatFileSize(file.size)}. Maximum size is 10MB. The image will be automatically compressed.`
                                })
                                return
                              }
                              setSelectedFile(file)
                            }
                          }}
                        />
                        <p className="text-xs text-muted-foreground text-center">
                          {selectedFile ? selectedFile.name : "JPG, PNG or GIF (Max 5MB)"}
                        </p>
                      </div>
                    </div>

                    {/* Title and Description */}
                    <div className="text-center">
                      <DialogTitle className="text-lg sm:text-xl font-bold">Add New Driver</DialogTitle>
                      <DialogDescription className="text-xs sm:text-sm">
                        Create a new truck driver account (saved to Firestore cloud database)
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <form autoComplete="off" className="grid gap-3 sm:gap-4 py-3 px-4 sm:px-6">
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                    <Label htmlFor="username" className="text-left sm:text-right font-medium text-sm">
                      Username*
                    </Label>
                    <Input
                      id="username"
                      type="email"
                      autoComplete="off"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="sm:col-span-3 border-border/50 focus:border-chart-1 h-9"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                    <Label htmlFor="password" className="text-left sm:text-right font-medium text-sm">
                      Password*
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="col-span-1 sm:col-span-3 border-border/50 focus:border-chart-1 h-9"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                    <Label htmlFor="fullName" className="text-left sm:text-right font-medium text-sm">
                      Full Name*
                    </Label>
                    <Input
                      id="fullName"
                      autoComplete="off"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="col-span-1 sm:col-span-3 border-border/50 focus:border-chart-1 h-9"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                    <Label htmlFor="licenseNumber" className="text-left sm:text-right font-medium text-sm">
                      License #
                    </Label>
                    <div className="relative col-span-1 sm:col-span-3">
                      <Input
                        id="licenseNumber"
                        type={showAddLicense ? "text" : "password"}
                        autoComplete="off"
                        value={formData.licenseNumber}
                        onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                        disabled={isSubmitting}
                        className="pr-10 border-border/50 focus:border-chart-1 h-9"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-auto">
                        <button
                          type="button"
                          onClick={() => setShowAddLicense(!showAddLicense)}
                          aria-label={showAddLicense ? "Hide license number" : "Show license number"}
                          className="h-6 w-6 rounded-md border border-border/50 flex items-center justify-center bg-background hover:bg-muted/50 transition-colors"
                        >
                          {showAddLicense ?
                            <EyeOff className="h-3 w-3" aria-hidden="true" /> :
                            <Eye className="h-3 w-3" aria-hidden="true" />
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                    <Label htmlFor="phoneNumber" className="text-left sm:text-right font-medium text-sm">
                      Phone
                    </Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      autoComplete="off"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      className="col-span-1 sm:col-span-3 border-border/50 focus:border-chart-1 h-9"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                    <Label htmlFor="email" className="text-left sm:text-right font-medium text-sm">
                      Email*
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="off"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="col-span-1 sm:col-span-3 border-border/50 focus:border-chart-1 h-9"
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
                    <Label htmlFor="status" className="text-left sm:text-right font-medium text-sm">
                      Status
                    </Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: "active" | "inactive" | "online" | "offline") => setFormData({ ...formData, status: value })}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className="col-span-1 sm:col-span-3 border-border/50 focus:border-chart-1 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </form>

                <DialogFooter>
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleAddDriver()
                    }}
                    disabled={isSubmitting || uploading}
                    className="bg-gradient-to-r from-chart-1 to-chart-2 hover:from-chart-1/90 hover:to-chart-2/90"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {uploading ? "Uploading..." : "Creating..."}
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Account
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {truckDrivers.map((driver) => (
          <Card
            key={driver.id}
            className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-card to-card/80 backdrop-blur-sm hover:scale-[1.02]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-chart-1/5 to-chart-2/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            <CardHeader className="relative pb-3 bg-gradient-to-r from-muted/20 to-muted/10 pt-6">
              <div className="flex items-center gap-3">
                {/* Profile Picture */}
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-chart-1/30 shadow-lg bg-muted">
                    {driver.profileImageUrl ? (
                      <Image
                        src={`/api/serve-mega?url=${encodeURIComponent(driver.profileImageUrl)}`}
                        alt={driver.fullName}
                        width={56}
                        height={56}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-chart-1 to-chart-2">
                        <User className="h-7 w-7 text-white" />
                      </div>
                    )}
                  </div>
                  {/* Status Badge - Green for online/active, Red for offline/inactive */}
                  {(() => {
                    const isOnline = driver.status === "online" || driver.status === "active"
                    return (
                      <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-card ${isOnline ? "bg-chart-4" : "bg-destructive"
                        }`}>
                        <div className={`w-full h-full rounded-full ${isOnline ? "animate-pulse" : ""
                          }`}></div>
                      </div>
                    )
                  })()}
                </div>

                {/* Driver Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-foreground truncate">{driver.fullName}</h3>
                  <p className="text-xs text-muted-foreground truncate">@{driver.username}</p>
                </div>

                {/* Status Badge - Green text for online, Red text for offline */}
                {(() => {
                  const isOnline = driver.status === "online" || driver.status === "active"
                  return (
                    <Badge
                      variant={isOnline ? "default" : "destructive"}
                      className={`shrink-0 font-medium shadow-sm text-xs ${isOnline
                        ? "bg-chart-4/10 text-chart-4 border-chart-4/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                        }`}
                    >
                      {isOnline ? "ONLINE" : "OFFLINE"}
                    </Badge>
                  )
                })()}
              </div>
            </CardHeader>

            <CardContent className="relative space-y-3 p-4">
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="bg-chart-5/10 p-1.5 rounded-md">
                    <CreditCard className="h-3 w-3 text-chart-5" />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-foreground">License:</span>
                    <span className="ml-2 text-muted-foreground">{driver.licenseNumber || "No license on file"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="bg-chart-2/10 p-1.5 rounded-md">
                    <Phone className="h-3 w-3 text-chart-2" />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-foreground">Phone:</span>
                    <span className="ml-2 text-muted-foreground">{driver.phoneNumber || "No phone on file"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="bg-chart-3/10 p-1.5 rounded-md">
                    <Mail className="h-3 w-3 text-chart-3" />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-foreground">Email:</span>
                    <span className="ml-2 text-muted-foreground truncate">{driver.email || "No email on file"}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(driver)}
                  className="flex-1 border-chart-1/20 hover:bg-chart-1/10 hover:border-chart-1/30 h-8 text-xs"
                >
                  <Edit className="h-3 w-3 mr-1.5" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="Delete driver"
                      className="border-destructive/20 text-destructive hover:bg-destructive/10 hover:border-destructive/30 bg-transparent h-8 px-2"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                      <span className="sr-only">Delete driver</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-0 shadow-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-3 text-xl">
                        <div className="bg-destructive/10 p-2 rounded-lg">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                        </div>
                        Delete Driver Account
                      </AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-4">
                          <p>
                            Are you sure you want to permanently delete <strong>{driver.fullName}</strong>'s account?
                          </p>

                          <div className="bg-destructive/5 p-4 rounded-xl border border-destructive/20">
                            <div className="text-sm text-destructive mb-2">
                              <strong>This will delete:</strong>
                            </div>
                            <ul className="text-sm text-destructive/80 space-y-1 ml-2">
                              <li>• Driver record from Firestore database</li>
                              <li>• All associated GPS tracking data</li>
                              <li>• All blind spot detection logs</li>
                            </ul>
                          </div>

                          <div className="text-sm font-semibold text-destructive">This action cannot be undone.</div>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteDriver(driver)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Delete Permanently
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {truckDrivers.length === 0 && !isLoading && (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-muted/20 to-muted/10 backdrop-blur-sm">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-chart-1 to-chart-2 rounded-2xl shadow-xl">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">No drivers found</h3>
                <p className="text-muted-foreground mb-4 max-w-md text-sm">
                  Start by adding your first driver account to begin managing your fleet
                </p>
                <Button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="bg-gradient-to-r from-chart-1 to-chart-2 hover:from-chart-1/90 hover:to-chart-2/90 shadow-lg"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Driver
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog - Enhanced with modern styling */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[450px] border-0 shadow-2xl bg-gradient-to-b from-background via-card to-card max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-2 sm:space-y-3 pb-3 sm:pb-4 px-4 sm:px-6 pt-4 sm:pt-6">
            <div className="flex flex-col items-center gap-4">
              {/* Profile Picture Upload Section */}
              <div className="flex flex-col items-center gap-3 w-full">
                <div className="relative">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-chart-1/20 shadow-lg bg-muted">
                    <Image
                      src={
                        selectedFile
                          ? URL.createObjectURL(selectedFile)
                          : editingDriver?.profileImageUrl
                            ? `/api/serve-mega?url=${encodeURIComponent(editingDriver.profileImageUrl)}`
                            : "/driver_logo.png"
                      }
                      alt="Profile Picture"
                      width={128}
                      height={128}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  {selectedFile && (
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => setSelectedFile(null)}
                      className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1.5 shadow-lg hover:bg-destructive/90 transition-all"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="flex flex-col items-center gap-2">
                  <label htmlFor="edit-profile-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-chart-1 to-chart-2 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {selectedFile ? "Change Photo" : editingDriver?.profileImageUrl ? "Replace Photo" : "Upload Photo"}
                      </span>
                    </div>
                  </label>
                  <input
                    id="edit-profile-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0]
                        // Validate file size (max 10MB before compression)
                        if (file.size > 10 * 1024 * 1024) {
                          alerts.error("File too large", {
                            details: `File size is ${formatFileSize(file.size)}. Maximum size is 10MB. The image will be automatically compressed.`
                          })
                          return
                        }
                        setSelectedFile(file)
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    {selectedFile ? selectedFile.name : "JPG, PNG or GIF (Max 5MB)"}
                  </p>
                </div>
              </div>

              {/* Title and Description */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="bg-gradient-to-br from-chart-1 to-chart-2 p-2 sm:p-2.5 rounded-lg shrink-0">
                  <Edit className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg sm:text-xl font-bold">Edit Driver Account</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    Update driver information in Firestore database
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <form autoComplete="off" className="grid gap-3 sm:gap-4 py-3 px-4 sm:px-6 pb-4 sm:pb-6">
            {/* Form fields with enhanced styling - keeping existing functionality */}
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
              <Label htmlFor="edit-username" className="text-left sm:text-right font-medium text-sm">
                Username*
              </Label>
              <Input
                id="edit-username"
                autoComplete="off"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="sm:col-span-3 border-border/50 focus:border-chart-1 h-9"
                disabled={isSubmitting}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
              <Label htmlFor="edit-password" className="text-left sm:text-right text-sm">
                Password*
              </Label>
              <Input
                id="edit-password"
                type="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="sm:col-span-3 h-9"
                disabled={isSubmitting}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
              <Label htmlFor="edit-fullName" className="text-left sm:text-right text-sm">
                Full Name*
              </Label>
              <Input
                id="edit-fullName"
                autoComplete="off"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="sm:col-span-3 h-9"
                disabled={isSubmitting}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
              <Label htmlFor="edit-licenseNumber" className="text-left sm:text-right text-sm">
                License #
              </Label>
              <div className="relative col-span-1 sm:col-span-3">
                <Input
                  id="edit-licenseNumber"
                  type={showEditLicense ? "text" : "password"}
                  autoComplete="off"
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                  className="pr-10 h-9"
                  disabled={isSubmitting}
                  readOnly={showEditLicense} // Prevent editing when visible
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => {
                      if (!showEditLicense) setVerifyLicensePassword(true)
                      else setShowEditLicense(false)
                    }}
                    className="h-6 w-6 rounded-md border border-border/50 flex items-center justify-center bg-background hover:bg-muted/50 transition-colors text-foreground"
                  >
                    {showEditLicense ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                </div>
                {/* Password Prompt Modal */}
                {verifyLicensePassword && (
                  <div className="absolute z-50 top-10 right-0 bg-card border border-border/50 rounded-lg shadow-2xl p-3 w-56 backdrop-blur-sm">
                    {/* The password required here is the current admin password (same as used for login and Security Settings) */}
                    <div className="mb-2 font-medium text-sm text-foreground">Enter your admin password to view</div>
                    <Input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Admin Password"
                      className="mb-2 h-8 border-border/50 focus:border-chart-1 bg-background text-foreground"
                      autoComplete="off"
                    />
                    {passwordError && <div className="text-destructive text-xs mb-2">{passwordError}</div>}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => verifyAdminPassword(passwordInput, "license")}
                        className="h-7 text-xs bg-gradient-to-r from-chart-1 to-chart-2 hover:from-chart-1/90 hover:to-chart-2/90"
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setVerifyLicensePassword(false)
                          setPasswordInput("")
                          setPasswordError("")
                        }}
                        className="h-7 text-xs border-border/50"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
              <Label htmlFor="edit-phoneNumber" className="text-left sm:text-right text-sm">
                Phone
              </Label>
              <Input
                id="edit-phoneNumber"
                autoComplete="off"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="sm:col-span-3 h-9"
                disabled={isSubmitting}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
              <Label htmlFor="edit-email" className="text-left sm:text-right text-sm">
                Email
              </Label>
              <Input
                id="edit-email"
                type="email"
                autoComplete="off"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="sm:col-span-3 h-9"
                disabled={isSubmitting}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
              <Label htmlFor="edit-status" className="text-left sm:text-right text-sm">
                Status
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value: "active" | "inactive") => setFormData({ ...formData, status: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger className="col-span-1 sm:col-span-3 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>

          <DialogFooter>
            {verifyUpdatePassword ? (
              <div className="w-full bg-muted/20 rounded-xl p-3 space-y-3">
                <div className="font-semibold text-foreground text-sm">Enter admin password to update account</div>
                <Input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Admin Password"
                  className="border-border/50 focus:border-chart-1 h-9"
                />
                {passwordError && <div className="text-destructive text-sm">{passwordError}</div>}
                <div className="flex gap-2">
                  <Button
                    onClick={() => verifyAdminPassword(passwordInput, "update")}
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-chart-1 to-chart-2 hover:from-chart-1/90 hover:to-chart-2/90 h-9 text-sm"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Confirm Update"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setVerifyUpdatePassword(false)
                      setPasswordInput("")
                      setPasswordError("")
                    }}
                    className="h-9 text-sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => setVerifyUpdatePassword(true)}
                disabled={isSubmitting}
                className="bg-gradient-to-r from-chart-1 to-chart-2 hover:from-chart-1/90 hover:to-chart-2/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {uploading ? "Uploading..." : "Updating..."}
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    Update Account
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
