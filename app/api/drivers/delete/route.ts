import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, initAdmin } from '@/lib/firebase-admin'

// Force dynamic rendering to prevent build-time Firebase initialization
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { firebaseUid } = await request.json()

    if (!firebaseUid) {
      return NextResponse.json(
        { error: 'Firebase UID is required' },
        { status: 400 }
      )
    }

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

    // Delete the user with Firebase Admin SDK
    await adminAuth.deleteUser(firebaseUid)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
