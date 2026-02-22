import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb, initAdmin } from '@/lib/firebase-admin'

// Force dynamic rendering to prevent build-time Firebase initialization
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const data = await request.json()
    
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

    // Get the authorization token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    // Verify admin token/password
    const token = authHeader.split('Bearer ')[1]
    if (!token) {
      return NextResponse.json(
        { error: 'Invalid authorization token' },
        { status: 401 }
      )
    }

    // Get admin Firestore instance
    const adminDb = getAdminDb()

    // Update the document in Firestore using admin SDK
    const driverRef = adminDb.collection('drivers').doc(id)
    await driverRef.update({
      ...data,
      lastUpdated: new Date().toISOString(),
      updatedBy: 'admin',
      updatedAt: new Date().toISOString()
    })

    // Return success response
    return NextResponse.json({
      message: 'Driver updated successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error updating driver:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update driver' },
      { status: 500 }
    )
  }
}
