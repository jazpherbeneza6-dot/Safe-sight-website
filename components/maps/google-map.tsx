"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { AlertTriangle, Maximize2 } from "lucide-react"

interface TruckLocation {
  id: string
  truckNumber: string
  driverName: string
  latitude: number
  longitude: number
  speed: number
  status: "moving" | "idle" | "offline"
  lastUpdate: Date
  profileImageUrl?: string
}

interface SpeedTrackingData {
  position: { lat: number; lng: number }
  timestamp: number
  calculatedSpeed: number
}

interface VehicleSpeedData {
  calculatedSpeed: number
  lastPosition: { lat: number; lng: number }
  lastTimestamp: number
}

interface GoogleMapProps {
  truckLocations: TruckLocation[]
  className?: string
  vehicleSpeeds?: Record<string, VehicleSpeedData>
}

let isGoogleMapsLoading = false
let isGoogleMapsLoaded = false
const loadingCallbacks: (() => void)[] = []

declare global {
  interface Window {
    google: any
    initGoogleMaps?: () => void
  }
}

export function GoogleMap({ truckLocations, className = "", vehicleSpeeds }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const overlaysRef = useRef<Map<string, any>>(new Map()) // Added overlays ref for marker labels
  const previousPositionsRef = useRef<Map<string, any>>(new Map())
  const speedTrackingRef = useRef<Map<string, SpeedTrackingData>>(new Map())
  const animationFramesRef = useRef<Map<string, number>>(new Map())
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const updateAnimationFrameRef = useRef<number | null>(null)
  const cachedSpeedRef = useRef<Map<string, number>>(new Map()) // Cache speed to prevent color changes on scroll
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapType, setMapType] = useState<"roadmap" | "satellite" | "hybrid">("roadmap")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [, forceUpdate] = useState({})

  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371 // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c // Distance in kilometers
  }, [])

  // ✅ SINGLE SOURCE OF TRUTH - Use only GPSTrackingView speed (no double calculation)
  const calculateSpeed = useCallback(
    (location: TruckLocation): number => {
      // Use ONLY speed from vehicleSpeeds prop (from gps-tracking-view)
      // This eliminates conflicting speed calculations
      const speed = vehicleSpeeds?.[location.id]?.calculatedSpeed ?? 0
      cachedSpeedRef.current.set(location.id, speed)
      return speed
    },
    [vehicleSpeeds],
  )

  // ✅ TIMESTAMP VALIDATION - Prevent old GPS data from moving marker backward
  const isFresh = useCallback((lastUpdate: Date): boolean => {
    const timestamp = lastUpdate.getTime()
    return Date.now() - timestamp < 30000 // Accept data within 30 seconds (network latency)
  }, [])

  const getMarkerIcon = useCallback((status: string, zoom = 11, speed = 0) => {
    const getScaleForZoom = (zoom: number) => {
      if (zoom <= 8) return 6 // Very far
      if (zoom <= 10) return 8 // Far
      if (zoom <= 12) return 10 // Medium
      if (zoom <= 14) return 12 // Close
      return 14 // Very close
    }

    const baseIcon = {
      path: window.google.maps.SymbolPath.CIRCLE || 0,
      scale: getScaleForZoom(zoom),
      strokeWeight: zoom <= 10 ? 2 : 4, // Thinner stroke for far zooms
      strokeColor: "#ffffff",
      fillOpacity: 1,
      anchor: new window.google.maps.Point(0, 0),
    }

    if (status === "offline") {
      return { ...baseIcon, fillColor: "#ef4444" } // red-500 - offline vehicles
    } else if (speed > 0) {
      return { ...baseIcon, fillColor: "#10b981" } // emerald-500 (green) - vehicle moving
    } else {
      return { ...baseIcon, fillColor: "#6b7280" } // gray-500 (gray) - vehicle stopped
    }
  }, [])

  // ✅ PRO VERSION - 3 METER DEAD ZONE (balanced: ignore noise but detect movement)
  const MIN_REAL_MOVE_METERS = 3 // Ignore GPS noise below 3 meters

  // ✅ CACHE FOR SNAPPED ROAD PATHS - Avoid excessive API calls
  const roadPathCacheRef = useRef<Map<string, { lat: number; lng: number }[]>>(new Map())

  // ✅ SNAP TO ROADS API - Get road-snapped path between two points
  const snapToRoads = useCallback(async (
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number
  ): Promise<{ lat: number; lng: number }[] | null> => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) return null

    // Create cache key
    const cacheKey = `${startLat.toFixed(5)},${startLng.toFixed(5)}-${endLat.toFixed(5)},${endLng.toFixed(5)}`

    // Check cache first
    const cached = roadPathCacheRef.current.get(cacheKey)
    if (cached) return cached

    try {
      const path = `${startLat},${startLng}|${endLat},${endLng}`
      const url = `https://roads.googleapis.com/v1/snapToRoads?path=${path}&interpolate=true&key=${apiKey}`

      const response = await fetch(url)
      if (!response.ok) {
        console.warn('Roads API error:', response.status)
        return null
      }

      const data = await response.json()

      if (data.snappedPoints && data.snappedPoints.length > 0) {
        const snappedPath = data.snappedPoints.map((point: any) => ({
          lat: point.location.latitude,
          lng: point.location.longitude
        }))

        // Cache the result (limit cache size)
        if (roadPathCacheRef.current.size > 100) {
          const firstKey = roadPathCacheRef.current.keys().next().value
          if (firstKey) roadPathCacheRef.current.delete(firstKey)
        }
        roadPathCacheRef.current.set(cacheKey, snappedPath)

        return snappedPath
      }
      return null
    } catch (error) {
      console.warn('Roads API fetch error:', error)
      return null
    }
  }, [])

  // ✅ ANIMATE MARKER ALONG ROAD PATH
  const animateMarker = useCallback(async (marker: any, newPosition: any, markerId: string) => {
    const currentPosition = marker.getPosition()
    if (!currentPosition) {
      marker.setPosition(newPosition)
      return
    }

    const startLat = currentPosition.lat()
    const startLng = currentPosition.lng()
    const endLat = newPosition.lat()
    const endLng = newPosition.lng()

    const distanceKm = calculateDistance(startLat, startLng, endLat, endLng)
    const distanceMeters = distanceKm * 1000

    // ✅ IGNORE GPS JITTER - Only animate if real movement (> 3 meters)
    if (distanceMeters < MIN_REAL_MOVE_METERS) {
      return // DO NOTHING (no jumping marker)
    }

    const existingFrame = animationFramesRef.current.get(markerId)
    if (existingFrame) {
      cancelAnimationFrame(existingFrame)
    }

    // ✅ TRY SNAP TO ROADS - Get road path for animation
    let animationPath: { lat: number; lng: number }[] = []

    // Only use Roads API for distances > 10 meters to save API calls
    if (distanceMeters > 10) {
      const snappedPath = await snapToRoads(startLat, startLng, endLat, endLng)
      if (snappedPath && snappedPath.length > 1) {
        animationPath = snappedPath
      }
    }

    // Fallback to direct line if no road path
    if (animationPath.length === 0) {
      animationPath = [
        { lat: startLat, lng: startLng },
        { lat: endLat, lng: endLng }
      ]
    }

    // Duration based on distance and path length
    const duration = Math.min(1200, 400 + distanceMeters * 15)
    const startTime = Date.now()

    // Smooth easing function (ease-out cubic)
    const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3)

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOut(progress)

      // Calculate position along the path
      const totalPathLength = animationPath.length - 1
      const pathProgress = eased * totalPathLength
      const segmentIndex = Math.min(Math.floor(pathProgress), totalPathLength - 1)
      const segmentProgress = pathProgress - segmentIndex

      const fromPoint = animationPath[segmentIndex]
      const toPoint = animationPath[Math.min(segmentIndex + 1, animationPath.length - 1)]

      const lat = fromPoint.lat + (toPoint.lat - fromPoint.lat) * segmentProgress
      const lng = fromPoint.lng + (toPoint.lng - fromPoint.lng) * segmentProgress

      const currentAnimPos = new window.google.maps.LatLng(lat, lng)
      marker.setPosition(currentAnimPos)

      // ✅ UPDATE OVERLAY POSITION - Info window follows the circle
      const overlay = overlaysRef.current.get(markerId)
      if (overlay && overlay.updatePosition) {
        overlay.updatePosition(currentAnimPos)
      }

      if (progress < 1) {
        const frame = requestAnimationFrame(animate)
        animationFramesRef.current.set(markerId, frame)
      } else {
        marker.setPosition(newPosition)
        // Final overlay update
        if (overlay && overlay.updatePosition) {
          overlay.updatePosition(newPosition)
        }
        animationFramesRef.current.delete(markerId)
      }
    }

    const frame = requestAnimationFrame(animate)
    animationFramesRef.current.set(markerId, frame)
  }, [calculateDistance, snapToRoads])

  useEffect(() => {
    const initializeMap = async () => {
      try {
        if (typeof window === "undefined") return

        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (!apiKey) {
          setError("Google Maps API key is not configured.")
          return
        }

        if (isGoogleMapsLoaded && window.google?.maps) {
          setIsLoaded(true)
          return
        }

        if (isGoogleMapsLoading) {
          loadingCallbacks.push(() => setIsLoaded(true))
          return
        }

        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
        if (existingScript) {
          const checkInterval = setInterval(() => {
            if (window.google?.maps) {
              clearInterval(checkInterval)
              isGoogleMapsLoaded = true
              setIsLoaded(true)
            }
          }, 100)
          return
        }

        isGoogleMapsLoading = true

        const script = document.createElement("script")
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`
        script.async = true
        script.defer = true

        script.onload = () => {
          isGoogleMapsLoaded = true
          isGoogleMapsLoading = false
          setIsLoaded(true)

          loadingCallbacks.forEach((callback) => callback())
          loadingCallbacks.length = 0
        }

        script.onerror = () => {
          isGoogleMapsLoading = false
          setError("Failed to load Google Maps API.")
        }

        document.head.appendChild(script)
      } catch (err) {
        console.error("Error initializing Google Maps:", err)
        setError("Failed to initialize Google Maps")
      }
    }

    initializeMap()
  }, [])

  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return

    try {
      const defaultCenter = { lat: 14.5995, lng: 120.9842 }

      const newMap = new window.google.maps.Map(mapRef.current, {
        zoom: 13,
        center: defaultCenter,
        mapTypeId: window.google.maps.MapTypeId[mapType.toUpperCase()],
        disableDefaultUI: true,
        zoomControl: false,
        gestureHandling: "greedy", // Enable one-finger pan and two-finger zoom on mobile
        draggable: true,
        scrollwheel: true,
        disableDoubleClickZoom: false,
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: false,
        styles: [
          {
            featureType: "all",
            elementType: "geometry",
            stylers: [{ color: "#2d3748" }], // Darker base color
          },
          {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#1a365d" }, { lightness: -10 }], // Dark blue ocean - calm
          },
          {
            featureType: "landscape",
            elementType: "geometry",
            stylers: [{ color: "#2d4a2e" }, { lightness: -20 }], // Dark green land - muted
          },
          {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ color: "#4a5568" }, { lightness: -30 }], // Dark gray roads
          },
          {
            featureType: "road.highway",
            elementType: "geometry",
            stylers: [{ color: "#718096" }, { lightness: -20 }], // Slightly lighter highways
          },
          {
            featureType: "road.arterial",
            elementType: "geometry",
            stylers: [{ color: "#5a6578" }, { lightness: -25 }],
          },
          {
            featureType: "road.local",
            elementType: "geometry",
            stylers: [{ color: "#4a5568" }, { lightness: -30 }],
          },
          {
            featureType: "poi",
            elementType: "geometry",
            stylers: [{ color: "#2d3748" }, { lightness: -20 }],
          },
          {
            featureType: "poi.business",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "transit",
            elementType: "geometry",
            stylers: [{ color: "#2d3748" }, { lightness: -20 }],
          },
          {
            featureType: "transit",
            elementType: "labels.icon",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "administrative",
            elementType: "geometry",
            stylers: [{ color: "#2d3748" }, { lightness: -10 }],
          },
          {
            featureType: "administrative.locality",
            elementType: "labels.text.fill",
            stylers: [{ color: "#e2e8f0" }, { lightness: 15 }, { weight: 0.5 }], // Softer, lighter text
          },
          {
            featureType: "administrative.neighborhood",
            elementType: "labels.text.fill",
            stylers: [{ color: "#cbd5e0" }, { lightness: 10 }, { weight: 0.3 }], // Softer neighborhood labels
          },
          {
            featureType: "poi",
            elementType: "labels.text.fill",
            stylers: [{ color: "#e2e8f0" }, { lightness: 10 }], // Softer POI labels
          },
          {
            featureType: "poi",
            elementType: "labels.text.stroke",
            stylers: [{ color: "#1a202c" }, { weight: 0.5 }], // Softer stroke
          },
          {
            featureType: "administrative",
            elementType: "labels.text",
            stylers: [{ weight: 0.5 }], // Lighter font weight for all admin labels
          },
        ],
      })

      mapInstanceRef.current = newMap

      // Add click handler to close overlay when clicking on the map
      window.google.maps.event.addListener(newMap, "click", () => {
        setSelectedVehicleId(null)
      })
    } catch (err) {
      console.error("Error creating map:", err)
      setError("Failed to create map instance")
    }
  }, [isLoaded, mapType, getMarkerIcon])

  const createMarkerOverlay = useCallback(
    (location: TruckLocation, position: any) => {
      if (!window.google || !mapInstanceRef.current) return null

      class MarkerOverlay extends window.google.maps.OverlayView {
        private div: HTMLElement | null = null
        private position: any
        private location: TruckLocation
        private isVisible = true
        private lastDrawnPosition: any = null // Track last drawn position to prevent unnecessary updates

        constructor(position: any, location: TruckLocation) {
          super()
          this.position = position
          this.location = location
        }

        onAdd() {
          this.div = document.createElement("div")
          this.div.style.position = "absolute"
          this.div.style.transform = "translate(-50%, calc(-100% - 25px))"
          this.div.style.pointerEvents = "auto"
          this.div.style.zIndex = "2000"
          this.div.style.transition = "none" // Removed all transitions to prevent flickering
          this.div.style.willChange = "transform"
          this.div.style.visibility = "hidden" // Start hidden until properly positioned
          this.div.style.cursor = "pointer"

          // Close overlay when clicking on it
          this.div.addEventListener("click", (e) => {
            e.stopPropagation()
            setSelectedVehicleId(null)
          })

          // Also allow clicking through to marker if clicking outside the overlay content
          // This allows clicking the marker again to close

          this.updateContent()

          const panes = this.getPanes()
          if (panes) {
            panes.floatPane.appendChild(this.div) // Use floatPane for better stability
          }
        }

        updateContent() {
          if (!this.div) return

          // Always recalculate speed for real-time updates
          const speed = calculateSpeed(this.location)
          // Update cache with latest speed
          cachedSpeedRef.current.set(this.location.id, speed)
          const statusColor = this.location.status === "offline" ? "#ef4444" : speed > 0 ? "#10b981" : "#6b7280"
          const statusText = this.location.status === "offline" ? "Offline" : speed > 0 ? "Moving" : "Stopped"

          this.div.innerHTML = `
          <div style="
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid ${statusColor};
            border-radius: 12px;
            padding: 12px 16px;
            font-size: 13px;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Inter', 'Helvetica Neue', sans-serif;
            font-weight: 400;
            letter-spacing: 0.01em;
            white-space: nowrap;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
            min-width: 160px;
            backdrop-filter: blur(12px);
            cursor: pointer;
          ">
            
            <div style="
              text-align: center;
              color: ${statusColor}; 
              font-weight: 600; 
              font-size: 11px; 
              text-transform: uppercase;
              letter-spacing: 0.3px;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              margin-bottom: 10px;
              padding: 4px 10px;
              background: ${statusColor}30; 
              border-radius: 6px;
              border: 1px solid ${statusColor}50;
            ">${statusText}</div>
            
            
            <div style="margin-bottom: 8px;">
              <div style="
                font-weight: 500; 
                color: #ffffff; 
                font-size: 14px;
                letter-spacing: 0.01em;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
              ">Name: ${this.location.driverName}</div>
            </div>
            
             
            <div style="
              border-top: 1px solid rgba(255, 255, 255, 0.1);
              padding-top: 8px;
            ">
              <div style="
                color: #94a3b8; 
                font-size: 12px;
                font-weight: 400;
                letter-spacing: 0.01em;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale; 
                margin-bottom: 6px;
              ">License: ${this.location.truckNumber}</div>
              
              <div style="
                color: ${speed > 0 ? '#10b981' : '#9ca3af'}; 
                font-size: 15px;
                font-weight: 600;
                letter-spacing: 0.01em;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
              ">Speed: ${speed > 0 ? speed.toFixed(1) : '0.0'} kph</div>
            </div>
            
            
            <div style="
              position: absolute;
              bottom: -8px;
              left: 50%;
              transform: translateX(-50%);
              width: 0;
              height: 0;
              border-left: 8px solid transparent;
              border-right: 8px solid transparent;
              border-top: 8px solid rgba(15, 23, 42, 0.95);
            "></div>
          </div>
        `
        }

        draw() {
          if (!this.div || !this.isVisible) return

          const overlayProjection = this.getProjection()
          if (!overlayProjection) return

          const position = overlayProjection.fromLatLngToDivPixel(this.position)
          if (!position) {
            this.div.style.visibility = "hidden"
            return
          }

          const positionKey = `${Math.round(position.x)},${Math.round(position.y)}`
          if (this.lastDrawnPosition === positionKey) {
            return
          }
          this.lastDrawnPosition = positionKey

          this.div.style.left = `${Math.round(position.x)}px`
          this.div.style.top = `${Math.round(position.y)}px`
          this.div.style.visibility = "visible"
        }

        onRemove() {
          if (this.div && this.div.parentNode) {
            this.div.parentNode.removeChild(this.div)
            this.div = null
          }
        }

        updatePosition(newPosition: any) {
          if (this.position && this.position.equals && this.position.equals(newPosition)) {
            return
          }
          this.position = newPosition
          this.lastDrawnPosition = null // Reset position tracking
          this.draw()
        }

        updateLocation(newLocation: TruckLocation) {
          this.location = newLocation
          // Always recalculate speed when location updates
          const currentSpeed = calculateSpeed(newLocation)
          cachedSpeedRef.current.set(newLocation.id, currentSpeed)
          this.updateContent()
        }

        setVisible(visible: boolean) {
          this.isVisible = visible
          if (this.div) {
            this.div.style.display = visible ? "block" : "none"
          }
        }
      }

      return new MarkerOverlay(position, location)
    },
    [calculateSpeed, cachedSpeedRef],
  )

  const createProfileMarker = useCallback(
    (location: TruckLocation, position: any, map: any) => {
      if (!window.google) return null

      class ProfileMarker extends window.google.maps.OverlayView {
        private div: HTMLElement | null = null
        private position: any
        private location: TruckLocation
        private speed: number = 0
        private listeners: { [key: string]: Function[] } = {}

        constructor(position: any, location: TruckLocation) {
          super()
          this.position = position
          this.location = location
          this.speed = location.speed || 0
        }

        onAdd() {
          this.div = document.createElement("div")
          this.div.style.position = "absolute"
          this.div.style.cursor = "pointer"
          this.div.style.transform = "translate(-50%, -50%)" // Center the marker
          this.div.style.zIndex = "1000" // Below tooltip but above map

          this.div.addEventListener("click", (e) => {
            e.stopPropagation()
            this.trigger("click")
          })

          this.updateContent()

          const panes = this.getPanes()
          if (panes) {
            panes.overlayMouseTarget.appendChild(this.div) // Allow clicks
          }
        }

        updateContent() {
          if (!this.div) return

          const status = this.location.status
          const speed = this.speed

          let borderColor = "#6b7280" // gray
          if (status === "offline") borderColor = "#ef4444" // red
          else if (speed > 0) borderColor = "#10b981" // green

          const size = 44 // Size of the marker
          const imageUrl = this.location.profileImageUrl
            ? `/api/serve-mega?url=${encodeURIComponent(this.location.profileImageUrl)}`
            : null

          this.div.innerHTML = `
            <div style="
              width: ${size}px;
              height: ${size}px;
              border-radius: 50%;
              border: 3px solid ${borderColor};
              background-color: white;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              transition: border-color 0.3s ease, transform 0.2s ease;
            ">
              ${imageUrl
              ? `<img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover;" />`
              : `<div style="width: 100%; height: 100%; background-color: #f1f5f9; display: flex; align-items: center; justify-content: center;">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px;">
                       <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                       <circle cx="12" cy="7" r="4"></circle>
                     </svg>
                   </div>`
            }
            </div>
          `
        }

        draw() {
          if (!this.div) return
          const projection = this.getProjection()
          if (!projection) return

          const point = projection.fromLatLngToDivPixel(this.position)
          if (point) {
            this.div.style.left = `${point.x}px`
            this.div.style.top = `${point.y}px`
          }
        }

        onRemove() {
          if (this.div && this.div.parentNode) {
            this.div.parentNode.removeChild(this.div)
            this.div = null
          }
        }

        setPosition(newPosition: any) {
          // Handle both LatLng object and literal
          if (newPosition.lat && typeof newPosition.lat === 'function') {
            this.position = newPosition
          } else {
            this.position = new window.google.maps.LatLng(newPosition.lat, newPosition.lng)
          }
          this.draw()
        }

        getPosition() {
          return this.position
        }

        updateStatus(location: TruckLocation, speed: number) {
          this.location = location
          this.speed = speed
          this.updateContent()
        }

        // Mimic google.maps.Marker event listener
        addListener(event: string, handler: Function) {
          if (!this.listeners[event]) this.listeners[event] = []
          this.listeners[event].push(handler)
          return {
            remove: () => {
              this.listeners[event] = this.listeners[event].filter(h => h !== handler)
            }
          }
        }

        trigger(event: string) {
          if (this.listeners[event]) {
            this.listeners[event].forEach(handler => handler())
          }
        }

        // Helper to match Marker interface
        getIcon() { return {} }
        setIcon() { }
        setMap(map: any) { super.setMap(map) }
      }

      const marker = new ProfileMarker(position, location)
      marker.setMap(map)
      return marker
    },
    []
  )

  useEffect(() => {
    if (!mapInstanceRef.current || !truckLocations.length) return

    const map = mapInstanceRef.current
    const currentMarkers = markersRef.current
    const currentOverlays = overlaysRef.current
    const previousPositions = previousPositionsRef.current

    const activeLocationIds = new Set(truckLocations.map((loc) => loc.id))

    currentMarkers.forEach((marker, id) => {
      if (!activeLocationIds.has(id)) {
        const frameId = animationFramesRef.current.get(id)
        if (frameId) {
          cancelAnimationFrame(frameId)
          animationFramesRef.current.delete(id)
        }

        marker.setMap(null)
        currentMarkers.delete(id)

        const overlay = currentOverlays.get(id)
        if (overlay) {
          overlay.setMap(null)
          currentOverlays.delete(id)
        }

        previousPositions.delete(id)
        speedTrackingRef.current.delete(id)
        cachedSpeedRef.current.delete(id)
      }
    })

    currentOverlays.forEach((overlay, id) => {
      overlay.setMap(null)
    })
    currentOverlays.clear()

    let shouldFitBounds = false
    const bounds = new window.google.maps.LatLngBounds()

    truckLocations.forEach((location) => {
      if (isNaN(location.latitude) || isNaN(location.longitude)) {
        console.warn(`Invalid coordinates for truck ${location.truckNumber}`)
        return
      }

      const newPosition = new window.google.maps.LatLng(location.latitude, location.longitude)
      bounds.extend(newPosition)

      const existingMarker = currentMarkers.get(location.id)
      const previousPosition = previousPositions.get(location.id)

      // Calculate speed immediately when position changes from database
      const realTimeSpeed = calculateSpeed(location)
      // Cache the speed to maintain consistent color during scroll/zoom
      cachedSpeedRef.current.set(location.id, realTimeSpeed)

      if (existingMarker) {
        // Update marker status (color/border)
        if (existingMarker.updateStatus) {
          existingMarker.updateStatus(location, realTimeSpeed)
        }

        // Ensure click handler is set up for existing markers (in case it wasn't set before)
        if (!existingMarker.hasClickListener) {
          existingMarker.addListener("click", () => {
            if (selectedVehicleId === location.id) {
              setSelectedVehicleId(null)
            } else {
              setSelectedVehicleId(location.id)
            }
          })
          existingMarker.hasClickListener = true
        }

        if (!previousPosition || !previousPosition.equals(newPosition)) {
          animateMarker(existingMarker, newPosition, location.id)
          previousPositions.set(location.id, newPosition)
        }
      } else {
        // Cache speed for new marker
        cachedSpeedRef.current.set(location.id, realTimeSpeed)

        // Create custom profile marker
        const marker = createProfileMarker(location, newPosition, map)

        if (marker) {
          marker.addListener("click", () => {
            if (selectedVehicleId === location.id) {
              setSelectedVehicleId(null)
            } else {
              setSelectedVehicleId(location.id)
            }
          })
          marker.hasClickListener = true

          currentMarkers.set(location.id, marker)
          previousPositions.set(location.id, newPosition)
          shouldFitBounds = true
        }
      }
    })

    if (selectedVehicleId) {
      const selectedLocation = truckLocations.find((loc) => loc.id === selectedVehicleId)
      if (selectedLocation) {
        const marker = currentMarkers.get(selectedVehicleId)
        const existingOverlay = currentOverlays.get(selectedVehicleId)

        if (marker) {
          const position = marker.getPosition()
          if (position) {
            if (existingOverlay) {
              existingOverlay.updatePosition(position)
              existingOverlay.updateLocation(selectedLocation)
            } else {
              const overlay = createMarkerOverlay(selectedLocation, position)
              if (overlay) {
                overlay.setMap(map)
                currentOverlays.set(selectedVehicleId, overlay)
              }
            }
          }
        }
      }
    }

    if (shouldFitBounds && currentMarkers.size > 0) {
      map.fitBounds(bounds)

      const listener = window.google.maps.event.addListener(map, "idle", () => {
        if (map.getZoom() && map.getZoom() > 15) {
          map.setZoom(15)
        }
        window.google.maps.event.removeListener(listener)
      })
    }
  }, [truckLocations, getMarkerIcon, animateMarker, calculateSpeed, createMarkerOverlay, selectedVehicleId])

  const lastIconCacheRef = useRef<Map<string, { fillColor: string; scale: number; strokeWeight: number }>>(new Map())

  useEffect(() => {
    if (!truckLocations.length || !mapInstanceRef.current) return

    // Clear existing interval and animation frame
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current)
    }
    if (updateAnimationFrameRef.current) {
      cancelAnimationFrame(updateAnimationFrameRef.current)
      updateAnimationFrameRef.current = null
    }

    // Real-time updates - sync with database update speed (as fast as Firebase sends data)
    // Use requestAnimationFrame for smooth, immediate updates when data arrives
    const updateMarkers = () => {
      const currentMarkers = markersRef.current
      const currentOverlays = overlaysRef.current
      const previousPositions = previousPositionsRef.current
      const currentZoom = mapInstanceRef.current?.getZoom() || 13

      truckLocations.forEach((location) => {
        const marker = currentMarkers.get(location.id)
        if (!marker) return

        // ✅ TIMESTAMP VALIDATION - Skip stale GPS data to prevent backward jumps
        if (!isFresh(location.lastUpdate)) return

        // Update marker position if location changed
        const newPosition = new window.google.maps.LatLng(location.latitude, location.longitude)
        const previousPosition = previousPositions.get(location.id)

        // ✅ PRO VERSION - Use proper distance calculation with 3 meter threshold
        const distanceKm = previousPosition
          ? calculateDistance(previousPosition.lat(), previousPosition.lng(), location.latitude, location.longitude)
          : Infinity
        const positionChanged = distanceKm * 1000 > 3 // Must move at least 3 meters

        if (positionChanged) {
          // Cancel any ongoing animation immediately to prevent delay
          const existingFrame = animationFramesRef.current.get(location.id)
          if (existingFrame) {
            cancelAnimationFrame(existingFrame)
            animationFramesRef.current.delete(location.id)
          }

          // Position changed, smoothly animate marker to new position (quick animation)
          animateMarker(marker, newPosition, location.id)
          previousPositions.set(location.id, newPosition)
        }

        // Calculate speed immediately when position changes (no delay)
        const realTimeSpeed = calculateSpeed(location)
        // Update cached speed to maintain consistent color
        cachedSpeedRef.current.set(location.id, realTimeSpeed)
        const newIcon = getMarkerIcon(location.status, currentZoom, realTimeSpeed)

        // Always check if icon color changed (for green/red/gray transitions)
        const cachedIcon = lastIconCacheRef.current.get(location.id)
        const iconChanged = !cachedIcon ||
          cachedIcon.fillColor !== newIcon.fillColor ||
          cachedIcon.scale !== newIcon.scale ||
          cachedIcon.strokeWeight !== newIcon.strokeWeight

        // Update icon if it changed (especially color for moving/stopped states)
        if (iconChanged) {
          marker.setIcon(newIcon)
          lastIconCacheRef.current.set(location.id, {
            fillColor: newIcon.fillColor,
            scale: newIcon.scale,
            strokeWeight: newIcon.strokeWeight
          })
        }

        // Update overlay position, location, and speed if it's visible and selected
        const overlay = currentOverlays.get(location.id)
        if (overlay && selectedVehicleId === location.id) {
          overlay.updatePosition(newPosition)
          overlay.updateLocation(location)
          // Force content update to refresh speed display
          overlay.updateContent()
        }
      })

      // Continue animation loop for smooth updates
      updateAnimationFrameRef.current = requestAnimationFrame(updateMarkers)
    }

    // Start the update loop
    updateAnimationFrameRef.current = requestAnimationFrame(updateMarkers)

    // Also set up interval as backup (250ms) for cases where requestAnimationFrame might be throttled
    updateIntervalRef.current = setInterval(() => {
      // This ensures updates even if requestAnimationFrame is paused (tab inactive, etc.)
    }, 1000) // Backup interval - very fast updates

    return () => {
      if (updateAnimationFrameRef.current) {
        cancelAnimationFrame(updateAnimationFrameRef.current)
        updateAnimationFrameRef.current = null
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
    }
  }, [truckLocations, calculateSpeed, getMarkerIcon, selectedVehicleId, animateMarker, isFresh, calculateDistance])

  const handleMapTypeChange = (type: "roadmap" | "satellite" | "hybrid") => {
    setMapType(type)
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setMapTypeId(window.google.maps.MapTypeId[type.toUpperCase()])
    }
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center glass-effect rounded-xl border border-border`}>
        <div className="text-center p-8 space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-destructive/10 rounded-full animate-pulse">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">Map Loading Error</h3>
            <p className="text-sm text-muted-foreground max-w-md">{error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-all duration-200 hover:scale-105"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className={`${className} flex items-center justify-center glass-effect rounded-xl`}>
        <div className="text-center p-8 space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">Loading Map</h3>
            <p className="text-sm text-muted-foreground">Initializing Google Maps...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`${className} ${isFullscreen ? "fixed inset-0 z-50" : "relative"} overflow-hidden rounded-xl border border-border shadow-lg`}
      style={{ minHeight: isFullscreen ? '100vh' : '500px' }}
    >
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: '500px', width: '100%', height: '100%' }} />

      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <div className="glass-effect rounded-lg p-2 border border-border">
          <div className="flex gap-1">
            <button
              onClick={() => handleMapTypeChange("roadmap")}
              className={`px-3 py-1.5 text-xs font-normal rounded transition-all ${mapType === "roadmap"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              style={{ letterSpacing: '0.01em', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
            >
              Map
            </button>
            <button
              onClick={() => handleMapTypeChange("satellite")}
              className={`px-3 py-1.5 text-xs font-normal rounded transition-all ${mapType === "satellite"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              style={{ letterSpacing: '0.01em', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
            >
              Satellite
            </button>
            <button
              onClick={() => handleMapTypeChange("hybrid")}
              className={`px-3 py-1.5 text-xs font-normal rounded transition-all ${mapType === "hybrid"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              style={{ letterSpacing: '0.01em', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}
            >
              Hybrid
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={toggleFullscreen}
            className="glass-effect p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all hover:scale-105"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
