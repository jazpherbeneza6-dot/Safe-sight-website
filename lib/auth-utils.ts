import { auth } from "@/firebase"
import { deleteUser } from "firebase/auth"
import { alerts } from "./alerts"

export interface SecureDeleteResult {
  success: boolean
  firestoreDeleted: boolean
  authDeleted: boolean
  error?: string
}

export async function secureDeleteUserAccount(
  firebaseUid: string | undefined,
  onFirestoreDelete: () => Promise<void>
): Promise<SecureDeleteResult> {
  const result: SecureDeleteResult = {
    success: false,
    firestoreDeleted: false,
    authDeleted: false
  }

  try {
    // Step 1: Delete Firestore documents first
    await onFirestoreDelete()
    result.firestoreDeleted = true

    // Step 2: If we have a Firebase UID, delete the auth account
    if (firebaseUid) {
      try {
        // Get the user reference from Firebase Auth
        const userRecord = await auth.currentUser?.getIdToken()
          .then(token => fetch(`/api/auth/admin/user/${firebaseUid}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }))
          .then(res => res.json())

        if (userRecord?.error) {
          throw new Error(userRecord.error)
        }

        result.authDeleted = true
      } catch (authError: any) {
        console.error("Error deleting Firebase auth account:", authError)
        // Don't throw here - we want to acknowledge the Firestore deletion succeeded
        result.error = `Firestore data deleted but auth account deletion failed: ${authError.message}`
      }
    }

    result.success = true
    return result

  } catch (error: any) {
    result.error = error.message
    throw error
  }
}
