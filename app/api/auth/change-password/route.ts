import { NextRequest, NextResponse } from "next/server"
import { getAdminDb, initAdmin } from "@/lib/firebase-admin"

// Force dynamic rendering to prevent build-time Firebase initialization
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_PASSWORD = "admin123"

export async function POST(request: NextRequest) {
  try {
    const { username, currentPassword, newPassword } = await request.json()

    if (!username || !currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: "Username, current password, and new password are required" },
        { status: 400 }
      )
    }

    // Validate Firebase Admin environment variables
    if (!process.env.FIREBASE_PROJECT_ID || 
        !process.env.FIREBASE_CLIENT_EMAIL || 
        !process.env.FIREBASE_PRIVATE_KEY) {
      return NextResponse.json(
        { success: false, message: "Firebase Admin configuration is missing" },
        { status: 500 }
      )
    }

    // Initialize Firebase Admin
    const app = initAdmin()
    if (!app) {
      return NextResponse.json(
        { success: false, message: "Failed to initialize Firebase Admin" },
        { status: 500 }
      )
    }

    // Get admin Firestore instance
    const adminDb = getAdminDb()

    // Get current password from Firestore
    const adminDocRef = adminDb.collection("admins").doc(username)
    const adminDoc = await adminDocRef.get()

    let currentPasswordFromDb: string
    if (adminDoc.exists) {
      const adminData = adminDoc.data()
      currentPasswordFromDb = adminData?.lastPasswordChange || DEFAULT_PASSWORD
    } else {
      currentPasswordFromDb = DEFAULT_PASSWORD
    }

    // Verify current password matches database password
    if (currentPassword !== currentPasswordFromDb) {
      return NextResponse.json(
        { success: false, message: "Current password is incorrect" },
        { status: 401 }
      )
    }

    // Update password in Firestore database
    await adminDocRef.set({
      passwordChanged: true,
      username: username,
      lastPasswordChange: newPassword,
      updatedAt: new Date().toISOString()
    }, { merge: true })

    return NextResponse.json({
      success: true,
      message: "Password changed successfully"
    })
  } catch (error: any) {
    console.error("Password change error:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to change password" },
      { status: 500 }
    )
  }
}

