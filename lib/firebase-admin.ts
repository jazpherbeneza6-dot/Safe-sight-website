import { getApps, initializeApp, cert } from "firebase-admin/app"
import { getAuth, type Auth } from "firebase-admin/auth"
import { getFirestore, type Firestore } from "firebase-admin/firestore"

let _adminAuth: Auth | null = null
let _adminDb: Firestore | null = null

// Function to initialize Firebase Admin (lazy initialization)
export const initAdmin = () => {
  // Check if already initialized
  const existingApps = getApps()
  if (existingApps.length > 0) {
    return existingApps[0]
  }

  // Check for required environment variables
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY

  const missingVars: string[] = []
  if (!projectId) missingVars.push("FIREBASE_PROJECT_ID")
  if (!clientEmail) missingVars.push("FIREBASE_CLIENT_EMAIL")
  if (!privateKey) missingVars.push("FIREBASE_PRIVATE_KEY")

  if (missingVars.length > 0) {
    const errorMsg = `❌ Firebase Admin initialization failed: Missing required environment variables: ${missingVars.join(", ")}. Please check your environment variables in Vercel Settings.`
    console.error(errorMsg)
    // Log which vars are missing for debugging
    console.error("Environment check:", {
      hasProjectId: !!projectId,
      hasClientEmail: !!clientEmail,
      hasPrivateKey: !!privateKey,
      privateKeyLength: privateKey?.length || 0,
    })
    return null
  }

  try {
    // Format private key - handle both escaped and unescaped newlines
    let formattedPrivateKey = (privateKey || "")
      .replace(/\\n/g, "\n")
      .replace(/"/g, "")
      .trim()

    // Ensure private key has proper format
    if (!formattedPrivateKey.includes("BEGIN PRIVATE KEY")) {
      console.error("❌ Firebase Admin: Private key format is invalid. It should start with '-----BEGIN PRIVATE KEY-----'")
      return null
    }

    const app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: formattedPrivateKey,
      }),
    })

    console.log("✅ Firebase Admin initialized successfully")
    return app
  } catch (error: any) {
    const errorMsg = error.message || String(error)
    console.error("❌ Firebase Admin initialization error:", errorMsg)
    
    // Provide more specific error messages
    if (errorMsg.includes("credential")) {
      console.error("❌ Credential error - check FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY format")
    } else if (errorMsg.includes("project")) {
      console.error("❌ Project error - check FIREBASE_PROJECT_ID")
    }
    
    return null
  }
}

// Lazy getters - only initialize when accessed at runtime
export const getAdminAuth = (): Auth => {
  if (!_adminAuth) {
    const app = initAdmin()
    if (!app) {
      throw new Error("Firebase Admin app not initialized. Please check your environment variables.")
    }
    _adminAuth = getAuth(app)
  }
  return _adminAuth
}

// Export adminAuth that initializes on first use
export const adminAuth = new Proxy({} as Auth, {
  get(target, prop) {
    const auth = getAdminAuth()
    const value = (auth as any)[prop]
    return typeof value === 'function' ? value.bind(auth) : value
  }
})

// Export the admin Firestore instance (lazy)
export const getAdminDb = (): Firestore => {
  if (!_adminDb) {
    const app = initAdmin()
    if (!app) {
      throw new Error("Firebase Admin app not initialized. Please check your environment variables.")
    }
    _adminDb = getFirestore(app)
  }
  return _adminDb
}

// Export adminDb that initializes on first use
export const adminDb = new Proxy({} as Firestore, {
  get(target, prop) {
    const db = getAdminDb()
    const value = (db as any)[prop]
    return typeof value === 'function' ? value.bind(db) : value
  }
})
