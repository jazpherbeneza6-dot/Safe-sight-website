"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertTriangle, ExternalLink, Copy, Database, Shield } from "lucide-react"
import { useState } from "react"

export function FirebaseSetupGuide() {
  const [copiedRules, setCopiedRules] = useState(false)

  const securityRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to drivers collection
    match /drivers/{document} {
      allow read, write: if true;
    }
    
    // Allow read/write access to locations collection
    match /locations/{document} {
      allow read, write: if true;
    }
    
    // Allow read/write access to detections collection
    match /detections/{document} {
      allow read, write: if true;
    }
  }
}`

  const copyRules = async () => {
    try {
      // Check if Clipboard API is available and supported
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(securityRules)
          setCopiedRules(true)
          setTimeout(() => setCopiedRules(false), 2000)
          return
        } catch (clipboardError) {
          // Clipboard API failed, fall back to fallback method
          console.warn("Clipboard API failed, using fallback method:", clipboardError)
        }
      }

      // Fallback method for browsers that don't support Clipboard API
      // or when clipboard API fails (e.g., not in HTTPS context)
      const textArea = document.createElement("textarea")
      textArea.value = securityRules
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()

      try {
        const successful = document.execCommand("copy")
        if (successful) {
          setCopiedRules(true)
          setTimeout(() => setCopiedRules(false), 2000)
        } else {
          throw new Error("execCommand('copy') returned false")
        }
      } catch (execError) {
        // Silently handle fallback failure - don't log as error
        // Last resort: show the text in an alert or prompt
        console.warn("Clipboard copy not available in this browser context")
        alert("Copy to clipboard is not supported in this browser. Please manually select and copy the security rules from the code block above.")
      } finally {
        document.body.removeChild(textArea)
      }
    } catch (error) {
      // Don't log as error - clipboard may not be available in all contexts
      console.warn("Clipboard copy not available:", error)
      // Show user-friendly error message
      alert("Copy to clipboard is not supported in this browser. Please manually select and copy the security rules from the code block above.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent mb-2">
          Firebase Setup Required
        </h2>
        <p className="text-lg text-slate-600">
          Complete these steps to fix the permissions error and enable full functionality
        </p>
      </div>

      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <strong>Permission Error Detected:</strong> Your Firestore database needs proper security rules to allow
          read/write operations.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {/* Step 1: Firebase Console */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                1
              </div>
              Open Firebase Console
            </CardTitle>
            <CardDescription>Access your Firebase project settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline">Project ID</Badge>
              <code className="bg-slate-100 px-2 py-1 rounded text-sm">blindspot-mode</code>
            </div>
            <Button asChild className="w-full">
              <a
                href="https://console.firebase.google.com/project/blindspot-mode"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Firebase Console
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Step 2: Authentication */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                2
              </div>
              Enable Authentication
            </CardTitle>
            <CardDescription>Enable Email/Password authentication</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>
                  Go to <strong>Authentication</strong> → <strong>Sign-in method</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>
                  Click on <strong>Email/Password</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>
                  Enable both <strong>Email/Password</strong> and <strong>Email link</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>
                  Click <strong>Save</strong>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Firestore Rules */}
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                3
              </div>
              Update Firestore Security Rules
            </CardTitle>
            <CardDescription>Copy and paste these rules to fix permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-orange-600" />
                <span>
                  Go to <strong>Firestore Database</strong> → <strong>Rules</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-orange-600" />
                <span>Replace the existing rules with the code below</span>
              </div>
            </div>

            <div className="relative">
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
                <code>{securityRules}</code>
              </pre>
              <Button
                size="sm"
                variant="outline"
                onClick={copyRules}
                className="absolute top-2 right-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                {copiedRules ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Rules
                  </>
                )}
              </Button>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> These rules allow full read/write access for development. For production,
                implement proper authentication-based rules.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Step 4: Publish Rules */}
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                4
              </div>
              Publish Rules
            </CardTitle>
            <CardDescription>Deploy the new security rules</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-purple-600" />
                <span>
                  Click <strong>Publish</strong> to deploy the rules
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-purple-600" />
                <span>Wait for the deployment to complete</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-purple-600" />
                <span>Refresh this page to test the connection</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <h3 className="text-lg font-semibold text-green-800">After Setup Complete</h3>
          </div>
          <div className="space-y-2 text-green-700">
            <p>✅ Create driver accounts without permission errors</p>
            <p>✅ Real-time data synchronization across devices</p>
            <p>✅ Secure cloud storage with Google Firestore</p>
            <p>✅ Full GPS tracking and blind spot detection logging</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
