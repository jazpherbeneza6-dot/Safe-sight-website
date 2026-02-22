import { toast } from '@/hooks/use-toast'

export type AlertType = 'error' | 'success' | 'info' | 'warning'

interface AlertOptions {
  title?: string
  details?: string
  duration?: number
}

function getVariantStyles(type: AlertType): "destructive" | "default" | "success" {
  switch (type) {
    case 'error':
      return 'destructive'
    case 'success':
      return 'success'
    case 'warning':
    case 'info':
    default:
      return 'default'
  }
}

export function showAlert(type: AlertType, message: string, options: AlertOptions = {}) {
  const { title, details, duration } = options

  // Handle Firebase errors specifically
  if (type === 'error' && message.startsWith('Firebase')) {
    const firebaseError = message as string
    // Extract error code if available
    const codeMatch = firebaseError.match(/\((.*?)\)/)
    const errorCode = codeMatch ? codeMatch[1] : ''
    
    // Format Firebase errors nicely
    return toast({
      title: title || 'Firebase Error',
      description: `${errorCode ? `[${errorCode}] ` : ''}${message}`,
      variant: 'destructive',
      duration: duration || 5000,
    })
  }

  // Regular alerts
  if (!message && !details) return; // Prevent empty toasts
  
  // Use 2 seconds for success messages (mobile-friendly), 4 seconds for others
  const defaultDuration = type === 'success' ? 2000 : (duration || 4000)
  
  return toast({
    title: title || type.charAt(0).toUpperCase() + type.slice(1),
    description: message + (details ? `\n${details}` : ''),
    variant: getVariantStyles(type),
    duration: duration || defaultDuration,
  })
}

// Helper functions for common alert types
export const alerts = {
  success: (message: string, options?: AlertOptions) => showAlert('success', message, options),
  error: (message: string, options?: AlertOptions) => showAlert('error', message, options),
  info: (message: string, options?: AlertOptions) => showAlert('info', message, options),
  warning: (message: string, options?: AlertOptions) => showAlert('warning', message, options),
  
  // Special handler for Firebase errors
  firebaseError: (error: any, options?: AlertOptions) => {
    let message = 'An error occurred'
    let details = ''

    if (error.code) {
      switch (error.code) {
        case 'auth/email-already-in-use':
          message = 'This email is already registered'
          break
        case 'auth/invalid-email':
          message = 'Invalid email address'
          break
        case 'auth/weak-password':
          message = 'Password is too weak'
          break
        case 'auth/operation-not-allowed':
          message = 'Operation not allowed'
          details = 'Email/password accounts are not enabled in Firebase Console'
          break
        case 'auth/network-request-failed':
          message = 'Network error'
          details = 'Please check your internet connection'
          break
        case 'permission-denied':
          message = 'Permission denied'
          details = 'Please check your Firebase security rules'
          break
        default:
          message = error.message || 'Unknown error'
      }
    } else {
      message = error.message || 'Unknown error'
    }

    // Only show alert if we have a message
    if (message === 'Unknown error' && !details) {
      console.error('Firebase error:', error);
      message = 'An unexpected error occurred';
      details = 'Please try again or contact support if the problem persists';
    }

    return showAlert('error', message, { 
      ...options,
      title: options?.title || 'Firebase Error',
      details: details || options?.details,
      duration: 5000 // Give more time for error messages
    })
  }
}
