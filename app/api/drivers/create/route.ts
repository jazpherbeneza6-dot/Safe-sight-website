import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, initAdmin } from '@/lib/firebase-admin'

// Force dynamic rendering to prevent build-time Firebase initialization
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { email, password, userData } = await request.json()

    // Validate environment variables
    if (!process.env.FIREBASE_PROJECT_ID || 
        !process.env.FIREBASE_CLIENT_EMAIL || 
        !process.env.FIREBASE_PRIVATE_KEY) {
      return NextResponse.json(
        { 
          error: "Firebase Admin SDK configuration is missing. Please check your environment variables." 
        }, 
        { status: 500 }
      )
    }

    // Initialize admin SDK
    initAdmin()
    const auth = getAdminAuth()

    // Create user with Firebase Admin SDK
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: userData.fullName,
    })

    return NextResponse.json({ 
      success: true, 
      uid: userRecord.uid 
    })
  } catch (error: any) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    )
  }
}
