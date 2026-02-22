"use client"

import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAdmin } from "@/contexts/admin-context"
import { GoogleMap } from "@/components/maps/google-map"
import { Navigation, Clock, Gauge, Satellite, Truck, TrendingUp, Activity, User } from "lucide-react"
import { useEffect, useRef, useState, useMemo, useCallback } from "react"

interface VehicleSpeedData {
  calculatedSpeed: number
  lastPosition: { lat: number; lng: number }
  lastTimestamp: number
}

export function GPSTrackingView() {
  const { truckLocations, truckDrivers } = useAdmin()

  const [vehicleSpeeds, setVehicleSpeeds] = useState<Record<string, VehicleSpeedData>>({})
  const speedUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371 // Earth's radius in kilometers (matching map calculation)
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c // Distance in kilometers
  }, [])

  const calculateRealTimeSpeed = useCallback((vehicleId: string, currentLat: number, currentLng: number): number => {
    const now = Date.now()
    let calculatedSpeed = 0

    setVehicleSpeeds((prev) => {
      const previousData = prev[vehicleId]

      // First time initialization
      if (!previousData) {
        return {
          ...prev,
          [vehicleId]: {
            calculatedSpeed: 0,
            lastPosition: { lat: currentLat, lng: currentLng },
            lastTimestamp: now,
          },
        }
      }

      const timeDiffSeconds = (now - previousData.lastTimestamp) / 1000

      // Minimum time: 0.5 seconds for faster response to database updates
      if (timeDiffSeconds < 0.5) {
        calculatedSpeed = previousData.calculatedSpeed
        return prev
      }

      const distance = calculateDistance(
        previousData.lastPosition.lat,
        previousData.lastPosition.lng,
        currentLat,
        currentLng,
      )

      // Minimum distance threshold: 2 meters for better sensitivity
      const MIN_DISTANCE_KM = 0.002 // 2 meters

      // Calculate instantaneous speed in km/h
      const timeDiffHours = timeDiffSeconds / 3600
      const instantSpeed = timeDiffHours > 0 ? distance / timeDiffHours : 0

      // If distance is too small, decay existing speed
      if (distance < MIN_DISTANCE_KM) {
        if (previousData.calculatedSpeed > 0) {
          // Decay gradually
          const alpha = 0.2
          const decayedSpeed = previousData.calculatedSpeed * (1 - alpha)
          calculatedSpeed = decayedSpeed < 0.3 ? 0 : decayedSpeed
        } else {
          calculatedSpeed = 0
        }

        return {
          ...prev,
          [vehicleId]: {
            calculatedSpeed,
            lastPosition: { lat: currentLat, lng: currentLng },
            lastTimestamp: now,
          },
        }
      }

      // Movement detected - calculate speed with smoothing
      const alpha = 0.7 // 70% new value, 30% old value for responsiveness
      const smoothedSpeed = previousData.calculatedSpeed * (1 - alpha) + instantSpeed * alpha

      // Very low threshold to detect even slow movement
      calculatedSpeed = smoothedSpeed < 0.2 ? 0 : smoothedSpeed

      return {
        ...prev,
        [vehicleId]: {
          calculatedSpeed,
          lastPosition: { lat: currentLat, lng: currentLng },
          lastTimestamp: now,
        },
      }
    })

    return calculatedSpeed
  }, [calculateDistance])

  // Update speed periodically for continuous tracking
  useEffect(() => {
    if (truckLocations.length === 0) return

    // Initial calculation for all vehicles
    truckLocations.forEach((location) => {
      if (location.status !== "offline" && location.latitude && location.longitude) {
        calculateRealTimeSpeed(location.id, location.latitude, location.longitude)
      }
    })

    // Set up interval for continuous updates - sync with database update speed
    speedUpdateIntervalRef.current = setInterval(() => {
      truckLocations.forEach((location) => {
        if (location.status !== "offline" && location.latitude && location.longitude) {
          calculateRealTimeSpeed(location.id, location.latitude, location.longitude)
        }
      })
    }, 1000) // Update every 1000ms - synced with GoogleMap updates

    return () => {
      if (speedUpdateIntervalRef.current) {
        clearInterval(speedUpdateIntervalRef.current)
      }
    }
  }, [truckLocations, calculateRealTimeSpeed])

  const getStatusColor = (status: string, speed?: number) => {
    if (status === "offline") return "bg-destructive"
    if (speed !== undefined && speed > 0) return "bg-chart-4"
    return "bg-muted-foreground"
  }

  const getStatusVariant = (status: string, speed?: number) => {
    if (status === "offline") return "destructive"
    if (speed !== undefined && speed > 0) return "default"
    return "secondary"
  }

  const getRealTimeSpeed = useCallback((vehicleId: string, fallbackSpeed: number): number => {
    const speedData = vehicleSpeeds[vehicleId]
    // Return speed in km/h - always use calculated speed if available (even if 0)
    if (speedData) {
      return speedData.calculatedSpeed // Already in km/h, use calculated speed (can be 0)
    }
    // If no calculated speed data yet, check if fallback speed exists
    // Fallback speed from database might be in different unit, convert if needed
    if (fallbackSpeed > 0) {
      // Assume fallback is already in km/h, but if it seems like mph (very high), convert
      return fallbackSpeed > 200 ? fallbackSpeed * 1.60934 : fallbackSpeed
    }
    // Return 0 if no data available yet
    return 0
  }, [vehicleSpeeds])

  const formatCoordinates = (lat: number, lng: number) => {
    return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`
  }

  // Get license number from driver data
  const getLicenseNumber = (driverName: string, driverId?: string) => {
    const driver = truckDrivers.find(
      (d) => d.fullName === driverName || d.id === driverId || d.firebaseUid === driverId
    )
    return driver?.licenseNumber || "No license"
  }

  // Get place name from coordinates using reverse geocoding
  const [placeNames, setPlaceNames] = useState<Record<string, string>>({})
  const [loadingPlaces, setLoadingPlaces] = useState<Record<string, boolean>>({})

  // Load place names for all locations
  useEffect(() => {
    if (typeof window === "undefined" || !window.google?.maps || truckLocations.length === 0) {
      return
    }

    truckLocations.forEach((location) => {
      // Skip if already loaded or loading
      if (placeNames[location.id] || loadingPlaces[location.id]) {
        return
      }

      setLoadingPlaces((prev) => ({ ...prev, [location.id]: true }))

      const geocoder = new window.google.maps.Geocoder()
      const latlng = { lat: location.latitude, lng: location.longitude }

      geocoder.geocode({ location: latlng }, (results: any, status: any) => {
        if (status === "OK" && results && results.length > 0) {
          const placeName = results[0].formatted_address || formatCoordinates(location.latitude, location.longitude)
          setPlaceNames((prev) => ({ ...prev, [location.id]: placeName }))
        } else {
          // Fallback to coordinates if geocoding fails
          setPlaceNames((prev) => ({ ...prev, [location.id]: formatCoordinates(location.latitude, location.longitude) }))
        }
        setLoadingPlaces((prev => {
          const newState = { ...prev }
          delete newState[location.id]
          return newState
        }))
      })
    })
  }, [truckLocations, placeNames, loadingPlaces])

  const getTimeSinceUpdate = (lastUpdate: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - lastUpdate.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`

    const diffHours = Math.floor(diffMins / 60)
    return `${diffHours}h ${diffMins % 60}m ago`
  }

  // Count moving trucks (green circles on map) - speed > 0 - OPTIMIZED: memoized
  const movingTrucks = useMemo(() => {
    return truckLocations.filter((truck) => {
      if (truck.status === "offline") return false
      const realTimeSpeed = getRealTimeSpeed(truck.id, truck.speed)
      // Green circle on map = moving (speed > 0)
      return realTimeSpeed > 0
    }).length
  }, [truckLocations, getRealTimeSpeed])

  // Count idle trucks (gray circles on map) - speed === 0 - OPTIMIZED: memoized
  const idleTrucks = useMemo(() => {
    return truckLocations.filter((truck) => {
      if (truck.status === "offline") return false
      const realTimeSpeed = getRealTimeSpeed(truck.id, truck.speed)
      // Gray circle on map = idle (speed === 0)
      return realTimeSpeed === 0 || realTimeSpeed <= 0
    }).length
  }, [truckLocations, getRealTimeSpeed])

  const offlineTrucks = useMemo(() => {
    return truckLocations.filter((truck) => truck.status === "offline").length
  }, [truckLocations])

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-chart-1/5 to-chart-2/5"></div>
          <CardContent className="relative flex items-center justify-between p-3 sm:p-4">
            <div className="space-y-1 min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Total Drivers</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground">{truckDrivers.length}</p>
              <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 shrink-0" />
                <span className="truncate">Registered Fleet</span>
              </div>
            </div>
            <div className="relative shrink-0 ml-2">
              <div className="bg-muted/80 dark:bg-muted p-2 sm:p-3 rounded-xl shadow-xl border border-border/50 flex items-center justify-center">
                <Image
                  src="/all drivers.png"
                  alt="All Drivers Logo"
                  width={32}
                  height={32}
                  className="sm:w-10 sm:h-10 object-contain"
                />
              </div>
              <div className="absolute -top-1 -right-1 w-2 h-2 sm:w-3 sm:h-3 bg-chart-4 rounded-full border-2 border-card animate-pulse"></div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-chart-4/10 to-chart-4/5"></div>
          <CardContent className="relative flex items-center justify-between p-3 sm:p-4">
            <div className="space-y-1 min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs font-semibold text-chart-4 uppercase tracking-wider truncate">Moving</p>
              <p className="text-xl sm:text-2xl font-bold text-chart-4">{movingTrucks}</p>
              <div className="flex items-center gap-1 text-[10px] sm:text-xs text-chart-4/70">
                <Activity className="h-3 w-3 shrink-0" />
                <span className="truncate">Active Routes</span>
              </div>
            </div>
            <div className="relative shrink-0 ml-2">
              <div className="bg-muted/80 dark:bg-muted p-2 sm:p-3 rounded-xl shadow-xl border border-border/50 flex items-center justify-center">
                <Image
                  src="/moving.png"
                  alt="Moving Logo"
                  width={32}
                  height={32}
                  className="sm:w-10 sm:h-10 object-contain"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-muted-foreground/10 to-muted-foreground/5"></div>
          <CardContent className="relative flex items-center justify-between p-3 sm:p-4">
            <div className="space-y-1 min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">Idle</p>
              <p className="text-xl sm:text-2xl font-bold text-muted-foreground">{idleTrucks}</p>
              <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground/70">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="truncate">Stationary</span>
              </div>
            </div>
            <div className="relative shrink-0 ml-2">
              <div className="bg-muted/80 dark:bg-muted p-2 sm:p-3 rounded-xl shadow-xl border border-border/50 flex items-center justify-center">
                <Image
                  src="/Idle.png"
                  alt="Idle Logo"
                  width={32}
                  height={32}
                  className="sm:w-10 sm:h-10 object-contain"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-card/50 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 to-destructive/5"></div>
          <CardContent className="relative flex items-center justify-between p-3 sm:p-4">
            <div className="space-y-1 min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs font-semibold text-destructive uppercase tracking-wider truncate">Offline</p>
              <p className="text-xl sm:text-2xl font-bold text-destructive">{offlineTrucks}</p>
              <div className="flex items-center gap-1 text-[10px] sm:text-xs text-destructive/70">
                <Satellite className="h-3 w-3 shrink-0" />
                <span className="truncate">No Signal</span>
              </div>
            </div>
            <div className="relative shrink-0 ml-2">
              <div className="bg-muted/80 dark:bg-muted p-2 sm:p-3 rounded-xl shadow-xl border border-border/50 flex items-center justify-center">
                <Image
                  src="/Offline.png"
                  alt="Offline Logo"
                  width={32}
                  height={32}
                  className="sm:w-10 sm:h-10 object-contain"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-2xl bg-gradient-to-br from-card to-card/80 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="relative h-[500px] sm:h-[600px] md:h-[700px] lg:h-[800px] mx-auto max-w-[1400px] w-full bg-muted/10">
            <GoogleMap truckLocations={truckLocations} className="w-full h-full" vehicleSpeeds={vehicleSpeeds} />
          </div>

          <div className="p-3 sm:p-4 bg-gradient-to-r from-muted/20 to-muted/10 border-t border-border/30">
            {truckLocations.length === 0 ? (
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-muted/50 rounded-xl mb-2">
                  <Truck className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">
                  {truckDrivers.length === 0
                    ? "No drivers added yet. Add drivers in Account Management to start tracking."
                    : "No active GPS tracking data available. Vehicles will appear on the map once GPS tracking is enabled."}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-[10px] sm:text-xs font-medium pt-2">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-chart-4 shadow-sm ring-2 ring-chart-4/20"></div>
                    <span className="text-foreground">Active</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-muted-foreground shadow-sm ring-2 ring-muted-foreground/20"></div>
                    <span className="text-foreground">Stopped</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-destructive shadow-sm ring-2 ring-destructive/20"></div>
                    <span className="text-foreground">Offline</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-[10px] sm:text-xs font-medium">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-chart-4 shadow-sm ring-2 ring-chart-4/20"></div>
                  <span className="text-foreground">Active ({movingTrucks})</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-muted-foreground shadow-sm ring-2 ring-muted-foreground/20"></div>
                  <span className="text-foreground">Stopped ({idleTrucks})</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-destructive shadow-sm ring-2 ring-destructive/20"></div>
                  <span className="text-foreground">Offline ({offlineTrucks})</span>
                </div>
                <div className="hidden sm:flex text-muted-foreground font-normal items-center gap-1">
                  <div className="w-2 h-2 bg-chart-1 rounded-full animate-pulse"></div>
                  <span>Click any marker for detailed vehicle information</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {truckLocations.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          <div className="text-center">
            <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Vehicle Status Details
            </h2>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1 px-4">Comprehensive fleet monitoring and status overview</p>
          </div>

          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {truckLocations.map((location) => {
              const realTimeSpeed = getRealTimeSpeed(location.id, location.speed)
              const displayStatus = location.status === "offline" ? "offline" : realTimeSpeed > 0 ? "moving" : "idle"
              const licenseNumber = getLicenseNumber(location.driverName, location.driverId)
              const placeName = placeNames[location.id] || formatCoordinates(location.latitude, location.longitude)

              return (
                <Card
                  key={location.id}
                  className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-card to-card/80 backdrop-blur-sm hover:scale-[1.01]"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-chart-1/5 to-chart-2/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                  <CardHeader
                    className={`relative pb-2 bg-gradient-to-r from-muted/20 to-muted/10 p-3 sm:p-4 border-b-2 ${location.status === "offline"
                      ? "border-destructive"
                      : displayStatus === "moving"
                        ? "border-chart-4"
                        : "border-muted-foreground"
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                        {/* Profile Picture instead of Truck Icon */}
                        <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-chart-1/30 shadow-lg bg-muted shrink-0">
                          {location.profileImageUrl ? (
                            <Image
                              src={`/api/serve-mega?url=${encodeURIComponent(location.profileImageUrl)}`}
                              alt={location.driverName}
                              width={40}
                              height={40}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-chart-1 to-chart-2">
                              <User className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{location.driverName}</div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground truncate">License: {licenseNumber}</div>
                        </div>
                      </CardTitle>
                      <Badge
                        variant={getStatusVariant(location.status, realTimeSpeed)}
                        className="font-semibold shadow-sm text-[10px] sm:text-xs shrink-0"
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full mr-1 ${getStatusColor(location.status, realTimeSpeed)}`}
                        ></div>
                        <span className="hidden sm:inline">{location.status === "offline" ? "OFFLINE" : displayStatus.toUpperCase()}</span>
                        <span className="sm:hidden">{location.status === "offline" ? "OFF" : displayStatus.toUpperCase().slice(0, 3)}</span>
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="relative space-y-2 sm:space-y-3 p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3 text-sm">
                      <div className="bg-chart-1/10 p-1.5 sm:p-2 rounded-lg shrink-0">
                        <Navigation className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-chart-1" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground text-[10px] sm:text-xs">Location</div>
                        <div className="text-muted-foreground text-[10px] sm:text-xs truncate">
                          {placeName}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 text-sm">
                      <div className="bg-chart-4/10 p-1.5 sm:p-2 rounded-lg shrink-0">
                        <Gauge className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-chart-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground text-[10px] sm:text-xs flex items-center gap-1 sm:gap-2 flex-wrap">
                          Current Speed
                          {realTimeSpeed > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-chart-4 rounded-full animate-pulse"></div>
                              <span className="text-[9px] sm:text-[10px] text-chart-4 font-bold">LIVE</span>
                            </div>
                          )}
                        </div>
                        <div className="text-muted-foreground text-xs sm:text-sm">
                          <span
                            className={`text-base sm:text-lg font-bold ${realTimeSpeed > 0 ? "text-chart-4" : "text-muted-foreground"}`}
                          >
                            {realTimeSpeed.toFixed(1)}
                          </span>{" "}
                          <span className="text-xs sm:text-sm font-semibold text-foreground">kph</span>
                          {realTimeSpeed > 0 && (
                            <span className="text-[10px] sm:text-xs text-muted-foreground ml-1 sm:ml-2">
                              ({(realTimeSpeed * 0.621371).toFixed(1)} mph)
                            </span>
                          )}
                          {realTimeSpeed === 0 && location.status !== "offline" && (
                            <span className="text-[10px] sm:text-xs text-muted-foreground ml-1 sm:ml-2">
                              (Stationary)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 text-sm">
                      <div className="bg-chart-2/10 p-1.5 sm:p-2 rounded-lg shrink-0">
                        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-chart-2" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground text-[10px] sm:text-xs">Last Update</div>
                        <div className="text-muted-foreground text-[10px] sm:text-xs">{getTimeSinceUpdate(location.lastUpdate)}</div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/50">
                      <div className="text-[10px] sm:text-xs text-muted-foreground text-center bg-muted/30 rounded-lg py-1 sm:py-1.5 px-2">
                        Updated: <span className="hidden sm:inline">{location.lastUpdate.toLocaleString()}</span>
                        <span className="sm:hidden">{location.lastUpdate.toLocaleDateString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {truckDrivers.length === 0 && (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-chart-1/5 via-chart-2/5 to-chart-1/5 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-chart-1 to-chart-2 rounded-2xl mb-4 shadow-xl">
                <Truck className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Getting Started with GPS Tracking</h3>
              <p className="text-muted-foreground text-sm">Follow these steps to set up your fleet monitoring system</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center space-y-3">
                <div className="bg-gradient-to-br from-chart-1 to-chart-2 text-white rounded-xl w-10 h-10 flex items-center justify-center text-lg font-bold mx-auto shadow-lg">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1 text-sm">Add Driver Accounts</h4>
                  <p className="text-xs text-muted-foreground">
                    Go to Account Management and create driver accounts for your fleet
                  </p>
                </div>
              </div>

              <div className="text-center space-y-3">
                <div className="bg-gradient-to-br from-chart-1 to-chart-2 text-white rounded-xl w-10 h-10 flex items-center justify-center text-lg font-bold mx-auto shadow-lg">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1 text-sm">Install GPS Devices</h4>
                  <p className="text-xs text-muted-foreground">
                    Install GPS tracking devices in your vehicles and connect them to the system
                  </p>
                </div>
              </div>

              <div className="text-center space-y-3">
                <div className="bg-gradient-to-br from-chart-1 to-chart-2 text-white rounded-xl w-10 h-10 flex items-center justify-center text-lg font-bold mx-auto shadow-lg">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1 text-sm">Monitor in Real-time</h4>
                  <p className="text-xs text-muted-foreground">
                    Track your fleet's location, speed, and status in real-time on this dashboard
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
