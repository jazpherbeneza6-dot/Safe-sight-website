import { useState, useEffect } from 'react'
import { collection, onSnapshot, query } from 'firebase/firestore'
import { getFirestoreInstance } from '@/firebase'
import type { TruckLocation } from '@/contexts/admin-context'

export const useDriverLocations = () => {
  const [locations, setLocations] = useState<TruckLocation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      // Get Firestore instance and create a query for the drivers collection
      const firestoreDb = getFirestoreInstance()
      const driversQuery = query(collection(firestoreDb, 'drivers'))

      // Set up real-time listener
      const unsubscribe = onSnapshot(driversQuery, (snapshot) => {
        const updatedLocations = snapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            driverId: doc.id,
            driverName: data.fullName || 'Unknown Driver',
            latitude: data.latitude || 0,
            longitude: data.longitude || 0,
            status: data.status || 'offline',
            lastUpdate: data.lastUpdated?.toDate() || new Date(),
            accuracy: 30, // Default accuracy in meters
            speed: 0, // Default speed
            truckNumber: data.licenseNumber || 'Unknown'
          } as TruckLocation
        })
        setLocations(updatedLocations)
        setLoading(false)
      }, (err) => {
        console.error('Error fetching driver locations:', err)
        setError(err.message)
        setLoading(false)
      })

      // Cleanup subscription on unmount
      return () => unsubscribe()
    } catch (err) {
      console.error('Error setting up driver locations listener:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }, [])

  return { locations, error, loading }
}
