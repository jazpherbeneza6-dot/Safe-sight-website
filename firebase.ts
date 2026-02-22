import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getFirestore, type Firestore, connectFirestoreEmulator } from "firebase/firestore"
import { getAuth, type Auth, connectAuthEmulator } from "firebase/auth"

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "blindspot-mode",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "blindspot-mode.firebasestorage.app",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "819835748579",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:819835748579:web:3a49e692310327fe8bc5d6",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-KDJRQNH0GL",
}

let _app: FirebaseApp | null = null
let _db: Firestore | null = null
let _auth: Auth | null = null

// Initialize Firebase App (only once)
function getApp(): FirebaseApp {
    if (_app) {
        return _app
    }

    // Check if already initialized
    const existingApps = getApps()
    if (existingApps.length > 0) {
        _app = existingApps[0]
        return _app
    }

    // Validate config before initializing
    const missingVars: string[] = []
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "") {
        missingVars.push("NEXT_PUBLIC_FIREBASE_API_KEY")
    }
    if (!firebaseConfig.projectId || firebaseConfig.projectId === "") {
        missingVars.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID")
    }
    
    if (missingVars.length > 0) {
        const errorMsg = `Firebase configuration is missing required environment variables: ${missingVars.join(", ")}. Please check your .env.local file.`
        console.error("❌", errorMsg)
        throw new Error(errorMsg)
    }

    try {
        _app = initializeApp(firebaseConfig)
        console.log("✅ Firebase initialized successfully")
        return _app
    } catch (error: any) {
        console.error("❌ Firebase initialization error:", error.message || error)
        throw error
    }
}

// Initialize Firestore (lazy)
function getDb(): Firestore {
    if (_db) {
        return _db
    }

    try {
        const app = getApp()
        _db = getFirestore(app)

        // Connect to emulator if in development and configured
        if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
            try {
                connectFirestoreEmulator(_db, 'localhost', 8080)
            } catch (e) {
                // Emulator already connected, ignore
            }
        }

        return _db
    } catch (error: any) {
        console.error("❌ Firestore initialization error:", error.message || error)
        throw error
    }
}

// Initialize Auth (lazy, client-side only for client SDK)
function getAuthInstance(): Auth {
    // Client-side Auth can work in some server contexts, but typically we want client-only
    // We'll allow it but warn if used incorrectly
    if (typeof window === 'undefined') {
        console.warn("⚠️ Firebase Auth (client SDK) is being used on the server. Consider using Firebase Admin SDK for server-side auth.")
    }

    if (_auth) {
        return _auth
    }

    try {
        const app = getApp()
        _auth = getAuth(app)

        // Connect to emulator if in development and configured
        if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
            try {
                connectAuthEmulator(_auth, 'http://localhost:9099')
            } catch (e) {
                // Emulator already connected, ignore
            }
        }

        return _auth
    } catch (error: any) {
        console.error("❌ Firebase Auth initialization error:", error.message || error)
        throw error
    }
}

// Export helper function to get Firestore instance (safer for Firebase function calls)
export function getFirestoreInstance(): Firestore {
    // Block server-side access for client SDK
    if (typeof window === 'undefined') {
        throw new Error("Firestore can only be used on the client side. Make sure your component has 'use client' directive.")
    }
    return getDb()
}

// Create a Proxy that behaves like a Firestore instance
// This allows direct property access while ensuring proper initialization
const createFirestoreProxy = (): Firestore => {
    return new Proxy({} as Firestore, {
        get(target, prop, receiver) {
            // Get the actual Firestore instance
            const dbInstance = getFirestoreInstance()
            
            // Get the property value from the actual instance
            const value = Reflect.get(dbInstance, prop, dbInstance)
            
            // If it's a function, bind it to the instance
            if (typeof value === 'function') {
                return value.bind(dbInstance)
            }
            
            return value
        },
        has(target, prop) {
            try {
                const dbInstance = getFirestoreInstance()
                return prop in dbInstance
            } catch {
                return false
            }
        },
        getPrototypeOf() {
            try {
                const dbInstance = getFirestoreInstance()
                return Reflect.getPrototypeOf(dbInstance)
            } catch {
                return Reflect.getPrototypeOf({})
            }
        },
        getOwnPropertyDescriptor(target, prop) {
            try {
                const dbInstance = getFirestoreInstance()
                return Reflect.getOwnPropertyDescriptor(dbInstance, prop)
            } catch {
                return undefined
            }
        },
        ownKeys() {
            try {
                const dbInstance = getFirestoreInstance()
                return Reflect.ownKeys(dbInstance)
            } catch {
                return []
            }
        }
    })
}

// Export db - this will be initialized lazily when first accessed
export const db: Firestore = createFirestoreProxy()

export const auth = new Proxy({} as Auth, {
    get(target, prop) {
        try {
            const authInstance = getAuthInstance()
            const value = (authInstance as any)[prop]
            return typeof value === 'function' ? value.bind(authInstance) : value
        } catch (error: any) {
            // If initialization fails, provide helpful error
            console.error("❌ Firebase Auth access error:", error.message || error)
            throw new Error(`Firebase Auth not available: ${error.message || 'Please check your Firebase configuration'}`)
        }
    },
    has(target, prop) {
        try {
            const authInstance = getAuthInstance()
            return prop in authInstance
        } catch {
            return false
        }
    }
})

// Helper function to test Firebase connection
export const testFirebaseConnection = async () => {
    try {
        const { doc, getDoc } = await import("firebase/firestore")
        const dbInstance = getDb()
        // Just try to access the database, don't actually read a document
        await getDoc(doc(dbInstance, "_test", "connection"))
        return { success: true, error: null }
    } catch (error: any) {
        // Connection errors are expected if test doc doesn't exist, but config errors are not
        if (error.code === 'permission-denied' || error.code === 'not-found') {
            // These are actually good - it means we're connected!
            return { success: true, error: null }
        }
        return { success: false, error: error.message || String(error) }
    }
}

// Export app instance getter
export const firebaseAppInstance = {
    get app() {
        return getApp()
    }
}
