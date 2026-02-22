// Google Maps configuration
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

// Default map center (should be set to your desired default location)
export const DEFAULT_MAP_CENTER = {
  lat: 0,
  lng: 0
}

// Map configuration
export const MAP_CONFIG = {
  DEFAULT_ZOOM: 15,
  MAX_ZOOM: 18,
  MIN_ZOOM: 10,
  ACCURACY_CIRCLE_RADIUS: 30 // in meters
}
