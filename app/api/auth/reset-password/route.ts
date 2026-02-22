import { NextRequest, NextResponse } from "next/server"
import { getAdminDb, initAdmin } from "@/lib/firebase-admin"
import nodemailer from "nodemailer"

// Force dynamic rendering to prevent build-time Firebase initialization
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_PASSWORD = "admin123"
const ADMIN_EMAIL = "safesight01@gmail.com"

export async function GET(request: NextRequest) {
  try {
    // Validate Firebase Admin environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY

    if (!projectId || !clientEmail || !privateKey) {
      const missing = []
      if (!projectId) missing.push("FIREBASE_PROJECT_ID")
      if (!clientEmail) missing.push("FIREBASE_CLIENT_EMAIL")
      if (!privateKey) missing.push("FIREBASE_PRIVATE_KEY")
      
      console.error("Missing Firebase Admin env vars:", missing)
      return new NextResponse(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Configuration Error</title>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background-image: url('/Background-1.png');
              background-size: cover;
              background-position: center;
            }
            body::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(0, 0, 0, 0.6);
              z-index: 0;
            }
            .container {
              background: rgba(15, 23, 42, 0.95);
              backdrop-filter: blur(20px);
              padding: 40px;
              border-radius: 16px;
              text-align: center;
              max-width: 600px;
              position: relative;
              z-index: 1;
              border: 1px solid rgba(239, 68, 68, 0.3);
            }
            h1 { color: #f87171; margin-bottom: 20px; }
            .error-details {
              background: rgba(30, 41, 59, 0.8);
              padding: 20px;
              border-radius: 12px;
              margin: 20px 0;
              text-align: left;
              border: 1px solid rgba(239, 68, 68, 0.3);
            }
            code { 
              background: rgba(239, 68, 68, 0.2); 
              padding: 2px 6px; 
              border-radius: 4px; 
              color: #f87171;
            }
            p { color: #cbd5e1; }
            ul { color: #cbd5e1; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Configuration Error</h1>
            <p>Firebase Admin environment variables are missing in Vercel:</p>
            <div class="error-details">
              <p><strong style="color: #f87171;">Missing variables:</strong></p>
              <ul>
                ${missing.map(v => `<li><code>${v}</code></li>`).join('')}
              </ul>
              <p style="margin-top: 20px; color: #60a5fa;"><strong>How to fix:</strong></p>
              <ol style="color: #cbd5e1;">
                <li>Go to <a href="https://vercel.com/terbalonhelen-7925s-projects/safesight-admin/settings/environment-variables" style="color: #60a5fa;">Vercel Dashboard → Settings → Environment Variables</a></li>
                <li>Add the missing variables from your .env.local file</li>
                <li>Redeploy the application</li>
              </ol>
            </div>
          </div>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' },
        status: 500,
      })
    }

    // Initialize Firebase Admin SDK
    try {
      const app = initAdmin()
      if (!app) {
        console.error("Firebase Admin initialization failed - app is null")
        return new NextResponse(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Initialization Error</title>
            <meta charset="utf-8">
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background-image: url('/Background-1.png');
                background-size: cover;
                background-position: center;
              }
              body::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                z-index: 0;
              }
              .container {
                background: rgba(15, 23, 42, 0.95);
                backdrop-filter: blur(20px);
                padding: 40px;
                border-radius: 16px;
                text-align: center;
                max-width: 600px;
                position: relative;
                z-index: 1;
                border: 1px solid rgba(239, 68, 68, 0.3);
              }
              h1 { color: #f87171; }
              p { color: #cbd5e1; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>❌ Firebase Admin Initialization Failed</h1>
              <p>Please check your Firebase Admin credentials in Vercel Environment Variables.</p>
              <p style="margin-top: 20px; color: #60a5fa;">Check the Vercel function logs for more details.</p>
            </div>
          </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' },
          status: 500,
        })
      }
      
      let adminDb
      try {
        adminDb = getAdminDb()
      } catch (dbError: any) {
        console.error("Failed to get Admin Firestore:", dbError)
        return NextResponse.json(
          {
            success: false,
            message: `Failed to initialize Firestore: ${dbError.message || "Unknown error"}`,
          },
          { status: 500 }
        )
      }
      
      // Reset password in Firestore database
      await adminDb.collection("admins").doc("admin").set(
        {
          passwordChanged: false,
          username: "admin",
          resetAt: new Date().toISOString(),
          lastPasswordChange: DEFAULT_PASSWORD, // Store default password in Firestore
        },
        { merge: true }
      )

      // Return success page
      return new NextResponse(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Password Reset Successful</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background-image: url('/Background-1.png');
              background-size: cover;
              background-position: center;
              background-repeat: no-repeat;
              position: relative;
            }
            body::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(0, 0, 0, 0.4);
              z-index: 0;
            }
            .container {
              background: rgba(15, 23, 42, 0.95);
              backdrop-filter: blur(20px);
              padding: 40px;
              border-radius: 16px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
              text-align: center;
              max-width: 500px;
              position: relative;
              z-index: 1;
              border: 1px solid rgba(59, 130, 246, 0.2);
            }
            h1 { 
              color: #60a5fa; 
              margin-bottom: 20px; 
              text-shadow: 0 0 20px rgba(96, 165, 250, 0.5);
            }
            p {
              color: #cbd5e1;
            }
            .success-icon { 
              font-size: 64px; 
              margin-bottom: 20px;
              filter: drop-shadow(0 0 10px rgba(34, 197, 94, 0.5));
            }
            .credentials {
              background: rgba(30, 41, 59, 0.8);
              border: 1px solid rgba(59, 130, 246, 0.3);
              padding: 20px;
              border-radius: 12px;
              margin: 20px 0;
              backdrop-filter: blur(10px);
            }
            .credential-item {
              margin: 10px 0;
              font-size: 18px;
            }
            .label { 
              font-weight: bold; 
              color: #94a3b8; 
            }
            .value { 
              color: #60a5fa; 
              font-weight: 600;
            }
            .button {
              display: inline-block;
              margin-top: 20px;
              padding: 12px 24px;
              background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
              box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
              transition: all 0.3s ease;
            }
            .button:hover { 
              background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
              box-shadow: 0 6px 20px rgba(59, 130, 246, 0.6);
              transform: translateY(-2px);
            }
            .warning {
              color: #fbbf24;
              font-weight: bold;
            }
            .success-message {
              color: #34d399;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Password Reset Successful!</h1>
            <p>The admin password has been reset to the default password.</p>
            <div class="credentials">
              <div class="credential-item">
                <span class="label">Username:</span> <span class="value">admin</span>
              </div>
              <div class="credential-item">
                <span class="label">Password:</span> <span class="value">${DEFAULT_PASSWORD}</span>
              </div>
            </div>
            <p class="warning">⚠️ Please change the password immediately after logging in.</p>
            <p class="success-message" style="margin-top: 20px;">✅ Password has been reset in the database. You can now login with the default password.</p>
            <a href="/login" class="button">Go to Login Page</a>
          </div>
        </body>
        </html>
      `, {
        headers: {
          'Content-Type': 'text/html',
        },
      })
    } catch (firebaseError: any) {
      console.error("Firebase error:", firebaseError)
      return new NextResponse(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Password Reset Failed</title>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: #fee2e2;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              text-align: center;
            }
            h1 { color: #dc2626; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Password Reset Failed</h1>
            <p>${firebaseError.message || "An error occurred while resetting the password."}</p>
          </div>
        </body>
        </html>
      `, {
        headers: {
          'Content-Type': 'text/html',
        },
        status: 500,
      })
    }
  } catch (error: any) {
    console.error("Password reset error:", error)
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to reset password.",
      },
      { status: 500 }
    )
  }
}

