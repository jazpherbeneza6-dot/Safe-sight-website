import { type NextRequest, NextResponse } from "next/server"
import { initializeApp, getApps } from "firebase/app"
import { getAuth, signInWithEmailAndPassword } from "firebase/auth"

// Force dynamic rendering to prevent build-time Firebase initialization
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ success: false, message: "Email and password are required" }, { status: 400 })
    }

    // Validate Firebase client environment variables
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      return NextResponse.json(
        { success: false, message: "Firebase configuration is missing. Please check your environment variables." },
        { status: 500 }
      )
    }

    // Initialize Firebase client SDK for server-side auth
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "blindspot-mode.firebaseapp.com",
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "blindspot-mode.firebasestorage.app",
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "819835748579",
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:819835748579:web:3a49e692310327fe8bc5d6",
    }

    // Get or initialize Firebase app
    let app = getApps()[0]
    if (!app) {
      app = initializeApp(firebaseConfig)
    }
    const auth = getAuth(app)

    // Authenticate with Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    // Create session token (in production, use proper JWT)
    const sessionToken = btoa(`${user.uid}:${Date.now()}`)

    return NextResponse.json({
      success: true,
      message: "Authentication successful",
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || email.split("@")[0],
      },
      sessionToken,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    })
  } catch (error: any) {
    console.error("Authentication error:", error)

    let message = "Authentication failed"
    if (error.code === "auth/user-not-found") {
      message = "User not found"
    } else if (error.code === "auth/wrong-password") {
      message = "Invalid password"
    } else if (error.code === "auth/invalid-email") {
      message = "Invalid email format"
    }

    return NextResponse.json({ success: false, message }, { status: 401 })
  }
}

// Enable CORS for Android app
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}
