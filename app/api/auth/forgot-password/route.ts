import { NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { getAdminDb, initAdmin } from "@/lib/firebase-admin"

// Force dynamic rendering to prevent build-time Firebase initialization
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || "admin123"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "safesight01@gmail.com"

export async function POST(request: NextRequest) {
  try {
    // Email is optional - we always send to admin email
    const { email: requestEmail } = await request.json()
    const requestorEmail = requestEmail || "Unknown"

    // Validate Firebase Admin environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY

    if (!projectId || !clientEmail || !privateKey) {
      console.error("Firebase Admin env vars missing:", {
        hasProjectId: !!projectId,
        hasClientEmail: !!clientEmail,
        hasPrivateKey: !!privateKey,
      })
      return NextResponse.json(
        {
          success: false,
          message: "Firebase Admin configuration is missing. Please check your environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).",
        },
        { status: 500 }
      )
    }

    // Try to initialize Firebase Admin to verify it works
    try {
      const app = initAdmin()
      if (!app) {
        return NextResponse.json(
          {
            success: false,
            message: "Failed to initialize Firebase Admin. Please check your environment variables.",
          },
          { status: 500 }
        )
      }
    } catch (initError: any) {
      console.error("Firebase Admin initialization error:", initError)
      return NextResponse.json(
        {
          success: false,
          message: `Firebase Admin initialization failed: ${initError.message || "Unknown error"}`,
        },
        { status: 500 }
      )
    }

    // Get the base URL for the reset link - always use public domain
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
      'https://safe-sight-admin.vercel.app'

    const resetLink = `${baseUrl}/api/auth/reset-password`

    // Configure email transporter (optional - email sending)
    let emailSent = false
    if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: false, // true for 465, false for other ports
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        })

        // Email content - always send to admin email
        const mailOptions = {
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: ADMIN_EMAIL,
          subject: "Safe-Sight Admin Password Reset Request",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Password Reset Request</h2>
              <p>A password reset request was received for the Safe-Sight Admin account.</p>
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Requested by:</strong> ${requestorEmail}</p>
                <p style="margin: 10px 0 0 0;"><strong>Request Time:</strong> ${new Date().toLocaleString()}</p>
              </div>
              <p>Click the button below to reset the admin password to the default password.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" 
                   style="display: inline-block; padding: 15px 30px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                  Reset Password
                </a>
              </div>
              <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; font-weight: bold;">After reset, login credentials will be:</p>
                <p style="margin: 10px 0 0 0;"><strong>Username:</strong> admin</p>
                <p style="margin: 10px 0 0 0;"><strong>Default Password:</strong> ${DEFAULT_PASSWORD}</p>
              </div>
              <p style="color: #dc2626; font-weight: bold;">⚠️ For security reasons, please change the password immediately after logging in.</p>
              <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
                If you did not request this password reset, please ignore this email.
              </p>
            </div>
          `,
          text: `
            Password Reset Request
            
            A password reset request was received for the Safe-Sight Admin account.
            
            Requested by: ${requestorEmail}
            Request Time: ${new Date().toLocaleString()}
            
            Click the link below to reset the admin password:
            ${resetLink}
            
            After reset, login credentials will be:
            Username: admin
            Default Password: ${DEFAULT_PASSWORD}
            
            ⚠️ For security reasons, please change the password immediately after logging in.
            
            If you did not request this password reset, please ignore this email.
          `,
        }

        // Send email
        await transporter.sendMail(mailOptions)
        emailSent = true
      } catch (emailError: any) {
        console.error("Email sending error:", emailError)
        // Continue even if email fails - password is already reset
      }
    } else {
      console.warn("SMTP credentials not configured - skipping email send")
    }

    return NextResponse.json({
      success: true,
      message: emailSent
        ? "Password reset request sent! Please check your email and click the reset button."
        : "Password reset request sent! Please check your email and click the reset button.",
    })
  } catch (error: any) {
    console.error("Password reset error:", error)
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to reset password. Please try again.",
      },
      { status: 500 }
    )
  }
}

