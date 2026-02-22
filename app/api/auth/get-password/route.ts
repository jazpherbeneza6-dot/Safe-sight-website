import { NextRequest, NextResponse } from "next/server"
import { getAdminDb, initAdmin } from "@/lib/firebase-admin"

// Force dynamic rendering to prevent build-time Firebase initialization
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_PASSWORD = "admin123"

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json()

    if (!username) {
      return NextResponse.json(
        { success: false, message: "Username is required" },
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

    // Get password from Firestore
    const adminDocRef = adminDb.collection("admins").doc(username)
    const adminDoc = await adminDocRef.get()

    let password: string
    let passwordChanged: boolean = false

    if (adminDoc.exists) {
      const adminData = adminDoc.data()
      password = adminData?.lastPasswordChange || DEFAULT_PASSWORD
      passwordChanged = adminData?.passwordChanged || false
    } else {
      password = DEFAULT_PASSWORD
      passwordChanged = false
    }

    return NextResponse.json({
      success: true,
      password: password,
      passwordChanged: passwordChanged
    })
  } catch (error: any) {
    console.error("Get password error:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Failed to get password" },
      { status: 500 }
    )
  }
}

