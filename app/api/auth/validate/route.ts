import { type NextRequest, NextResponse } from "next/server"

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { sessionToken } = await request.json()

    if (!sessionToken) {
      return NextResponse.json({ success: false, message: "Session token required" }, { status: 400 })
    }

    // Decode session token (in production, use proper JWT validation)
    try {
      const decoded = atob(sessionToken)
      const [uid, timestamp] = decoded.split(":")
      const tokenTime = Number.parseInt(timestamp)
      const now = Date.now()
      const expirationTime = 24 * 60 * 60 * 1000 // 24 hours

      if (now - tokenTime > expirationTime) {
        return NextResponse.json({ success: false, message: "Session expired" }, { status: 401 })
      }

      return NextResponse.json({
        success: true,
        message: "Session valid",
        user: { uid },
        expiresAt: tokenTime + expirationTime,
      })
    } catch (decodeError) {
      return NextResponse.json({ success: false, message: "Invalid session token" }, { status: 401 })
    }
  } catch (error) {
    console.error("Session validation error:", error)
    return NextResponse.json({ success: false, message: "Validation failed" }, { status: 500 })
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
