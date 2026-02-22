"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useRef, useMemo } from "react"
import { db, getFirestoreInstance } from "@/firebase"
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore"
import { alerts } from "@/lib/alerts"

export interface TruckDriver {
  id: string
  username: string
  password: string
  fullName: string
  licenseNumber: string
  phoneNumber: string
  email: string
  status: "active" | "inactive" | "online" | "offline"
  createdAt: Date
  lastLogin?: Date
  firebaseUid?: string
  profileImageUrl?: string
}

export type TruckLocation = {
  accuracy?: number; // GPS accuracy in meters
  id: string
  driverId: string
  driverName: string
  latitude: number
  longitude: number
  status: "moving" | "idle" | "offline"
  speed: number
  lastUpdate: Date
  truckNumber: string
  profileImageUrl?: string
}

// ... (existing code)



export interface BlindSpotDetection {
  id: string
  truckId: string
  vehicleId?: string
  driverName: string
  detectionType: "person" | "vehicle" | "barrier" | "cyclist" | "animal"
  latitude: number
  longitude: number
  timestamp: Date
  severity: "low" | "medium" | "high" | "critical"
  description: string
  alertLevel?: string
  direction?: string
  placeName?: string
  distance?: number
  sensorId?: string
}

interface AdminContextType {
  truckDrivers: TruckDriver[]
  truckLocations: TruckLocation[]
  blindSpotDetections: BlindSpotDetection[]
  addTruckDriver: (driver: Omit<TruckDriver, "id" | "createdAt">) => Promise<void>
  updateTruckDriver: (id: string, driver: Partial<TruckDriver>) => Promise<void>
  deleteTruckDriver: (id: string) => Promise<void>
  updateTruckLocation: (location: TruckLocation) => void
  addBlindSpotDetection: (detection: Omit<BlindSpotDetection, "id">) => void
  isLoading: boolean
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

// Firestore collection names
const COLLECTIONS = {
  DRIVERS: "drivers",
  LOCATIONS: "locations",
  DETECTIONS: "detections",
}

// Helper function to convert Firestore timestamp to Date
const convertTimestamp = (timestamp: any): Date => {
  if (timestamp && timestamp.toDate) {
    return timestamp.toDate()
  }
  if (timestamp && timestamp.seconds) {
    return new Date(timestamp.seconds * 1000)
  }
  // Handle milliseconds timestamp (number)
  if (typeof timestamp === 'number') {
    return new Date(timestamp)
  }
  return new Date(timestamp)
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [truckDrivers, setTruckDrivers] = useState<TruckDriver[]>([])
  const [truckLocations, setTruckLocations] = useState<TruckLocation[]>([])
  const [blindSpotDetections, setBlindSpotDetections] = useState<BlindSpotDetection[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Cache drivers map to avoid repeated getDocs calls
  const driversMapRef = useRef<Map<string, string>>(new Map())

  // Load drivers and locations from Firestore on mount and set up real-time listeners
  useEffect(() => {
    // Safety check: ensure we're on the client side and db is initialized
    if (typeof window === 'undefined') {
      console.warn("AdminProvider: Skipping Firestore initialization on server side")
      setIsLoading(false)
      return
    }

    // Safety check: ensure db is initialized
    if (!db) {
      console.error("Firestore db is not initialized")
      setIsLoading(false)
      return
    }

    // Get the actual Firestore instance (safer for Firebase function calls)
    let firestoreDb
    let driversRef, locationsRef, detectionsRef
    try {
      firestoreDb = getFirestoreInstance()
      driversRef = collection(firestoreDb, COLLECTIONS.DRIVERS)
      locationsRef = collection(firestoreDb, COLLECTIONS.LOCATIONS)
      detectionsRef = collection(firestoreDb, COLLECTIONS.DETECTIONS)
    } catch (error: any) {
      console.error("Error initializing Firestore or creating collection references:", error)
      setIsLoading(false)
      return
    }

    // Set up real-time listener for drivers - OPTIMIZED for faster updates
    const unsubscribeDrivers = onSnapshot(
      driversRef,
      {
        // Optimize listener options for faster updates
        includeMetadataChanges: false, // Only trigger on actual data changes
      },
      (snapshot) => {
        const drivers: TruckDriver[] = []
        const newDriversMap = new Map<string, string>()

        snapshot.forEach((doc) => {
          const data = doc.data()
          const fullName = data.fullName || "Unknown Driver"

          drivers.push({
            id: doc.id,
            username: data.username,
            password: data.password || "",
            fullName: fullName,
            licenseNumber: data.licenseNumber || "",
            phoneNumber: data.phoneNumber || "",
            email: data.email,
            status: data.status,
            createdAt: convertTimestamp(data.createdAt),
            lastLogin: data.lastLogin ? convertTimestamp(data.lastLogin) : undefined,
            firebaseUid: data.firebaseUid,
            profileImageUrl: data.profileImageUrl,
          })

          // Update drivers map cache
          if (data.firebaseUid) {
            newDriversMap.set(data.firebaseUid, fullName)
          }
          newDriversMap.set(doc.id, fullName)
        })

        // Sort by creation date (newest first)
        drivers.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

        // Update cached drivers map
        driversMapRef.current = newDriversMap
        setTruckDrivers(drivers)
        setIsLoading(false)
      },
      (error) => {
        console.error("Error loading drivers from Firestore:", error)
        setIsLoading(false)
      },
    )

    // Set up real-time listener for locations - OPTIMIZED for fast coordinate reading
    // Locations are stored in drivers collection, so we read from driversRef
    // Using includeMetadataChanges: false for faster updates (only data changes)
    const unsubscribeLocations = onSnapshot(
      driversRef,
      {
        // Optimize listener options for faster updates
        includeMetadataChanges: false, // Only trigger on actual data changes, not metadata
      },
      (snapshot) => {
        // Use array with pre-allocated size for better performance
        const locations: TruckLocation[] = []

        snapshot.forEach((doc) => {
          const data = doc.data()
          // Fast check: only process if location exists
          if (data.latitude != null && data.longitude != null) {
            // Optimize timestamp conversion
            let lastUpdate: Date
            if (data.lastUpdated?.toDate) {
              lastUpdate = data.lastUpdated.toDate()
            } else if (data.timestamp?.toDate) {
              lastUpdate = data.timestamp.toDate()
            } else if (data.lastUpdated?.seconds) {
              lastUpdate = new Date(data.lastUpdated.seconds * 1000)
            } else if (data.timestamp?.seconds) {
              lastUpdate = new Date(data.timestamp.seconds * 1000)
            } else {
              lastUpdate = new Date()
            }

            locations.push({
              id: doc.id,
              driverId: doc.id,
              driverName: data.fullName || "Unknown Driver",
              latitude: data.latitude,
              longitude: data.longitude,
              status: data.status || "offline",
              speed: data.speed || 0,
              lastUpdate: lastUpdate,
              truckNumber: data.licenseNumber || "Unknown",
              profileImageUrl: data.profileImageUrl,
            })
          }
        })

        // Only sort if we have locations (optimization)
        if (locations.length > 0) {
          // Use faster sort for small arrays, or keep current for larger arrays
          locations.sort((a, b) => b.lastUpdate.getTime() - a.lastUpdate.getTime())
        }

        // Update state immediately
        setTruckLocations(locations)
      },
      (error) => {
        console.error("Error loading locations from Firestore:", error)
      },
    )

    // Set up real-time listener for detections - OPTIMIZED: uses cached drivers map
    const unsubscribeDetections = onSnapshot(
      detectionsRef,
      (snapshot) => {
        const detections: BlindSpotDetection[] = []
        const currentDriversMap = driversMapRef.current // Use cached map instead of fetching

        snapshot.forEach((doc) => {
          const data = doc.data()

          // Get driver name from vehicleId (which should match driver's firebaseUid or id)
          let driverName = "Unknown Driver"
          const vehicleId = data.vehicleId || data.truckId

          if (vehicleId) {
            // Try to find driver by vehicleId (could be firebaseUid or driver document id)
            driverName = currentDriversMap.get(vehicleId) || "Unknown Driver"
          }

          // Map detection type from sensorId or direction if available
          let detectionType: "person" | "vehicle" | "barrier" | "cyclist" | "animal" = "vehicle"
          if (data.detectionType) {
            detectionType = data.detectionType
          }

          // Map severity from alertLevel
          let severity: "low" | "medium" | "high" | "critical" = "medium"
          const alertLevel = (data.alertLevel || "").toUpperCase()
          if (alertLevel === "DANGER" || alertLevel === "CRITICAL") {
            severity = "critical"
          } else if (alertLevel === "HIGH" || alertLevel === "WARNING") {
            severity = "high"
          } else if (alertLevel === "MEDIUM" || alertLevel === "INFO") {
            severity = "medium"
          } else if (alertLevel === "LOW" || alertLevel === "SAFE") {
            severity = "low"
          } else if (data.severity) {
            severity = data.severity
          }

          // Create description from available data
          let description = data.description || `${detectionType} detected`
          if (data.direction && data.placeName) {
            description = `${detectionType} detected ${data.direction} at ${data.placeName}`
          } else if (data.direction) {
            description = `${detectionType} detected ${data.direction}`
          } else if (data.placeName) {
            description = `${detectionType} detected at ${data.placeName}`
          }

          detections.push({
            id: doc.id,
            truckId: vehicleId || doc.id,
            vehicleId: vehicleId,
            driverName: driverName,
            detectionType: detectionType,
            latitude: data.latitude || 0,
            longitude: data.longitude || 0,
            timestamp: convertTimestamp(data.timestamp),
            severity: severity,
            description: description,
            alertLevel: data.alertLevel || undefined,
            direction: data.direction || undefined,
            placeName: data.placeName || undefined,
            distance: data.distance || undefined,
            sensorId: data.sensorId || undefined,
          })
        })

        // Sort by timestamp (newest first)
        detections.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

        setBlindSpotDetections(detections)
      },
      (error) => {
        console.error("Error loading detections from Firestore:", error)
      },
    )

    // Cleanup listeners on unmount
    return () => {
      unsubscribeDrivers()
      unsubscribeLocations()
      unsubscribeDetections()
    }
  }, [])

  const addTruckDriver = async (driver: Omit<TruckDriver, "id" | "createdAt">) => {
    try {
      const driverData = {
        ...driver,
        createdAt: serverTimestamp(),
      }

      const firestoreDb = getFirestoreInstance()
      await addDoc(collection(firestoreDb, COLLECTIONS.DRIVERS), driverData)
      // The real-time listener will automatically update the state
    } catch (error) {
      console.error("Error adding driver to Firestore:", error)
      throw error
    }
  }

  const updateTruckDriver = async (id: string, updates: Partial<TruckDriver>) => {
    try {
      const firestoreDb = getFirestoreInstance()
      const driverRef = doc(firestoreDb, COLLECTIONS.DRIVERS, id)

      // Create a clean update object with only defined values
      const cleanUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value
        }
        return acc
      }, {} as Record<string, any>)

      // Add timestamps
      const updateData = {
        ...cleanUpdates,
        lastUpdated: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      await updateDoc(driverRef, updateData)
      console.log('Driver updated in Firestore:', id)
    } catch (error) {
      console.error("Error updating driver in Firestore:", error)
      throw error
    }
  }

  const deleteTruckDriver = async (id: string) => {
    try {
      // Get the driver data first to get the Firebase UID
      const firestoreDb = getFirestoreInstance()
      const driverDoc = doc(firestoreDb, COLLECTIONS.DRIVERS, id)
      const driverSnap = await getDoc(driverDoc)

      if (!driverSnap.exists()) {
        throw new Error("Driver not found")
      }

      const driverData = driverSnap.data()
      const { secureDeleteUserAccount } = await import("@/lib/auth-utils")

      const result = await secureDeleteUserAccount(
        driverData.firebaseUid,
        async () => {
          // Delete from Firestore
          await deleteDoc(driverDoc)
        }
      )

      if (result.error) {
        // This means Firestore deletion succeeded but Auth deletion failed
        alerts.warning("Partial deletion", {
          title: "Account partially deleted",
          details: "Driver data was removed but there was an issue removing their login credentials. Please contact support."
        })
      }

    } catch (error) {
      console.error("Error deleting driver:", error)
      throw error
    }
  }

  const updateTruckLocation = (location: TruckLocation) => {
    setTruckLocations((prev) => prev.map((loc) => (loc.id === location.id ? location : loc)))
  }

  const addBlindSpotDetection = (detection: Omit<BlindSpotDetection, "id">) => {
    const newDetection: BlindSpotDetection = {
      ...detection,
      id: Date.now().toString(),
    }
    setBlindSpotDetections((prev) => [newDetection, ...prev])
  }

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      truckDrivers,
      truckLocations,
      blindSpotDetections,
      addTruckDriver,
      updateTruckDriver,
      deleteTruckDriver,
      updateTruckLocation,
      addBlindSpotDetection,
      isLoading,
    }),
    [truckDrivers, truckLocations, blindSpotDetections, isLoading]
  )

  return <AdminContext.Provider value={contextValue}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider")
  }
  return context
}
