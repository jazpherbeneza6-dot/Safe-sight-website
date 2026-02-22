import { NextRequest, NextResponse } from "next/server"
import { getAdminAuth, initAdmin } from "@/lib/firebase-admin"

// Force dynamic rendering to prevent build-time Firebase initialization
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    // Validate Firebase Admin environment variables
    if (!process.env.FIREBASE_PROJECT_ID || 
        !process.env.FIREBASE_CLIENT_EMAIL || 
        !process.env.FIREBASE_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Firebase Admin SDK configuration is missing. Please check your environment variables.' },
        { status: 500 }
      )
    }

    // Initialize Firebase Admin
    const app = initAdmin()
    if (!app) {
      return NextResponse.json(
        { error: 'Failed to initialize Firebase Admin. Please check your environment variables.' },
        { status: 500 }
      )
    }

    // Get admin auth instance
    const adminAuth = getAdminAuth()

    // Verify the request is from an authenticated admin
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const token = authHeader.split("Bearer ")[1]
    const decodedToken = await adminAuth.verifyIdToken(token)

    // Check if the user is an admin
    if (!decodedToken.admin) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      )
    }

    // Delete the user from Firebase Auth
    await adminAuth.deleteUser(params.uid)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting user:", error)
    return NextResponse.json(
      { error: error.message },
      { status: error.code === "auth/user-not-found" ? 404 : 500 }
    )
  }
}
