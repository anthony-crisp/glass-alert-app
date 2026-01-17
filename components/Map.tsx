'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, MarkerClusterer } from '@react-google-maps/api';
import { Report, hasDeviceConfirmedCleared, hasDeviceConfirmedStillThereRecently } from '@/lib/db';
import { getOrCreateDeviceId } from '@/lib/utils';
import { formatDate, calculateDistance } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Libraries to load (defined outside component to prevent re-renders)
const LIBRARIES: ("places" | "geometry" | "drawing" | "visualization")[] = [];

// Map container style
const containerStyle = {
  width: '100%',
  height: '100%',
};

// Default center (London) - fallback if no saved location and geolocation fails
const defaultCenter = {
  lat: 51.5074,
  lng: -0.1278,
};
const DEFAULT_ZOOM = 12; // Wider zoom for fallback
const USER_LOCATION_ZOOM = 16; // Closer zoom when we have user location

// localStorage keys for persisting map state
const STORAGE_KEY_CENTER = 'lastMapCenter';
const STORAGE_KEY_ZOOM = 'lastMapZoom';

// Get saved map state from localStorage
function getSavedMapState(): { center: { lat: number; lng: number }; zoom: number } | null {
  if (typeof window === 'undefined') return null;

  try {
    const savedCenter = localStorage.getItem(STORAGE_KEY_CENTER);
    const savedZoom = localStorage.getItem(STORAGE_KEY_ZOOM);

    if (savedCenter && savedZoom) {
      const [lat, lng] = JSON.parse(savedCenter);
      const zoom = parseInt(savedZoom, 10);

      // Validate the values
      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(zoom)) {
        return { center: { lat, lng }, zoom };
      }
    }
  } catch (error) {
    console.warn('Failed to load saved map state:', error);
  }

  return null;
}

// Save map state to localStorage
function saveMapState(lat: number, lng: number, zoom: number): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY_CENTER, JSON.stringify([lat, lng]));
    localStorage.setItem(STORAGE_KEY_ZOOM, zoom.toString());
  } catch (error) {
    console.warn('Failed to save map state:', error);
  }
}

// Custom map pin icon URLs - using 2x version for crisp retina display
const ACTIVE_PIN_ICON = '/images/map_pin_warn_2x.png';
const ACTIVE_PIN_ICON_FALLBACK = '/images/map_pin_warn_1x.png';

// Green resolved pin icon (SVG data URL)
const createResolvedIcon = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 38 48" width="38" height="48">
      <!-- Pin shadow -->
      <ellipse cx="19" cy="46" rx="8" ry="2" fill="rgba(0,0,0,0.2)"/>
      <!-- Pin body -->
      <path fill="#22c55e" stroke="#166534" stroke-width="2" d="M19 2C8.5 2 0 10.5 0 21c0 14 19 25 19 25s19-11 19-25C38 10.5 29.5 2 19 2z"/>
      <!-- Checkmark -->
      <path fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M12 22l5 5 9-9"/>
    </svg>
  `;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const resolvedIconUrl = createResolvedIcon();

// Amber draggable pin for reporting
const createDraggableIcon = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80" width="60" height="80">
      <!-- Outer glow -->
      <ellipse cx="30" cy="76" rx="14" ry="3" fill="rgba(245,158,11,0.3)"/>
      <!-- Pin shadow -->
      <ellipse cx="30" cy="74" rx="10" ry="2" fill="rgba(0,0,0,0.2)"/>
      <!-- Pin body with gradient effect -->
      <path fill="#f59e0b" stroke="#ffffff" stroke-width="3" d="M30 4C15 4 3 16 3 31c0 20 27 45 27 45s27-25 27-45C57 16 45 4 30 4z"/>
      <!-- Inner highlight -->
      <path fill="#fbbf24" d="M30 8C18 8 8 18 8 31c0 6 4 14 10 22 4-6 12-10 12-10s8 4 12 10c6-8 10-16 10-22C52 18 42 8 30 8z" opacity="0.4"/>
      <!-- Center circle -->
      <circle fill="#ffffff" cx="30" cy="28" r="14" stroke="#f59e0b" stroke-width="2"/>
      <!-- Crosshair -->
      <path stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" d="M30 18v20M20 28h20"/>
      <!-- Center dot -->
      <circle fill="#f59e0b" cx="30" cy="28" r="3"/>
    </svg>
  `;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// User location blue dot
const createUserLocationIcon = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <circle cx="14" cy="14" r="12" fill="rgba(59,130,246,0.2)" stroke="rgba(59,130,246,0.4)" stroke-width="1"/>
      <circle cx="14" cy="14" r="6" fill="#3b82f6" stroke="#fff" stroke-width="2"/>
    </svg>
  `;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const draggableIcon = createDraggableIcon();
const userIcon = createUserLocationIcon();

interface ReportCardProps {
  report: Report;
  onStillThere: (id: string) => void;
  onCleared: (id: string) => void;
}

function ReportCard({ report, onStillThere, onCleared }: ReportCardProps) {
  const deviceId = typeof window !== 'undefined' ? getOrCreateDeviceId() : '';
  const hasConfirmedCleared = hasDeviceConfirmedCleared(report, deviceId);
  const hasConfirmedStillThere = hasDeviceConfirmedStillThereRecently(report, deviceId);
  const stillThereCount = report.stillThereCount || 0;

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-green-200 w-64 p-4">
      {/* Status badge */}
      <div className="mb-3">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          report.resolved
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {report.resolved ? 'Cleared' : 'Active Hazard'}
        </span>
      </div>

      {/* Photo */}
      {(report.photoBase64 || report.photoUrl) && (
        <div className="mb-3 rounded-lg overflow-hidden">
          <img
            src={report.photoUrl || report.photoBase64}
            alt="Hazard photo"
            className="w-full h-36 object-cover"
          />
        </div>
      )}

      {/* Description */}
      <p className="font-semibold text-gray-800 mb-2 text-sm leading-snug">
        {report.desc || 'Broken glass hazard reported'}
      </p>

      {/* Date */}
      <p className="text-xs text-gray-500 mb-3">
        {formatDate(report.date)}
      </p>

      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-4 p-2 bg-gray-50 rounded-lg">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-700">
            {report.clearedCount}/3 confirmations
          </span>
          {stillThereCount > 0 && (
            <span className="text-xs text-red-500">
              {stillThereCount} report{stillThereCount !== 1 ? 's' : ''} still there
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full ${
                i < report.clearedCount ? 'bg-green-500' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Action buttons - stacked for mobile */}
      {!report.resolved && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onCleared(report.id)}
            disabled={hasConfirmedCleared}
            className={`w-full py-3 text-sm font-semibold rounded-lg transition-all ${
              hasConfirmedCleared
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white shadow-md hover:shadow-lg'
            }`}
          >
            {hasConfirmedCleared ? 'You confirmed cleared' : "It's Cleared"}
          </button>
          <button
            onClick={() => onStillThere(report.id)}
            disabled={hasConfirmedStillThere}
            className={`w-full py-3 text-sm font-semibold rounded-lg transition-all ${
              hasConfirmedStillThere
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            {hasConfirmedStillThere ? 'Reported still there' : 'Still There'}
          </button>
        </div>
      )}
    </div>
  );
}

// Admin-specific card for council view
interface AdminReportCardProps {
  report: Report;
  onToggleResolved: (id: string) => void;
  onToggleFlagged: (id: string) => void;
  onToggleNoGlassFound: (id: string) => void;
}

function AdminReportCard({ report, onToggleResolved, onToggleFlagged, onToggleNoGlassFound }: AdminReportCardProps) {
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-emerald-200 w-56 p-3">
      {/* Status indicator */}
      <div className="mb-2">
        {report.noGlassFound ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
            No Glass Found
          </span>
        ) : report.resolved ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            Cleared
          </span>
        ) : report.flagged ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
            Flagged
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
            Active Hazard
          </span>
        )}
      </div>

      {/* Photo */}
      {(report.photoBase64 || report.photoUrl) && (
        <div className="mb-3 rounded-lg overflow-hidden">
          <img
            src={report.photoUrl || report.photoBase64}
            alt="Hazard photo"
            className="w-full h-32 object-cover"
          />
        </div>
      )}

      {/* Description */}
      <p className="font-semibold text-gray-800 mb-2 text-sm leading-snug">
        {report.desc || 'Broken glass hazard reported'}
      </p>

      {/* Date */}
      <p className="text-xs text-gray-500 mb-3">
        {formatDate(report.date)}
      </p>

      {/* Admin action buttons */}
      <div className="flex flex-col gap-1.5">
        {/* Cleared toggle */}
        <button
          onClick={() => onToggleResolved(report.id)}
          className={`w-full py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            report.resolved
              ? 'bg-green-500 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {report.resolved ? 'Cleared' : 'Mark Cleared'}
        </button>

        {/* No Glass Found toggle */}
        <button
          onClick={() => onToggleNoGlassFound(report.id)}
          className={`w-full py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            report.noGlassFound
              ? 'bg-purple-500 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
          {report.noGlassFound ? 'No Glass' : 'No Glass Found'}
        </button>

        {/* Flagged toggle */}
        <button
          onClick={() => onToggleFlagged(report.id)}
          className={`w-full py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            report.flagged
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
          </svg>
          {report.flagged ? 'Flagged' : 'Flag'}
        </button>
      </div>
    </div>
  );
}

interface MapProps {
  reports: Report[];
  onStillThere: (id: string) => void;
  onCleared: (id: string) => void;
  isReporting: boolean;
  reportLocation: [number, number] | null;
  onReportLocationChange: (pos: [number, number]) => void;
  // Admin mode props
  isAdmin?: boolean;
  onToggleResolved?: (id: string) => void;
  onToggleFlagged?: (id: string) => void;
  onToggleNoGlassFound?: (id: string) => void;
}

export default function Map({
  reports,
  onStillThere,
  onCleared,
  isReporting,
  reportLocation,
  onReportLocationChange,
  isAdmin = false,
  onToggleResolved,
  onToggleFlagged,
  onToggleNoGlassFound,
}: MapProps) {
  // Load Google Maps API with hook (better caching than LoadScript)
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [showRecenter, setShowRecenter] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const hasInitialCentered = useRef(false);
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastSavedCenterRef = useRef<{ lat: number; lng: number } | null>(null);

  // Initialize map center and zoom from localStorage or defaults
  const savedState = getSavedMapState();
  const [mapCenter, setMapCenter] = useState(savedState?.center || defaultCenter);
  const [mapZoom, setMapZoom] = useState(savedState?.zoom || DEFAULT_ZOOM);

  // Real-time location tracking with watchPosition
  // Pauses when user is in reporting mode to avoid conflicts with draggable pin
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    // Pause tracking while user is placing/dragging the report pin
    if (isReporting) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    const handlePositionUpdate = (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;
      const location = { lat: latitude, lng: longitude };
      setUserLocation(location);
      userLocationRef.current = location; // Keep ref in sync for callbacks
      setLocationError(null);

      // Only auto-centre on first location fix if no saved state exists
      if (!hasInitialCentered.current) {
        hasInitialCentered.current = true;

        // If no saved location, centre on user and save it
        const hasSavedState = getSavedMapState() !== null;
        if (!hasSavedState) {
          setMapCenter(location);
          setMapZoom(USER_LOCATION_ZOOM);
          saveMapState(latitude, longitude, USER_LOCATION_ZOOM);
          if (mapRef.current) {
            mapRef.current.panTo(location);
            mapRef.current.setZoom(USER_LOCATION_ZOOM);
          }
        }
      }
    };

    const handlePositionError = (error: GeolocationPositionError) => {
      let message = 'Could not get your location';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          message = 'Location permission denied. Please enable location access.';
          break;
        case error.POSITION_UNAVAILABLE:
          message = 'Location unavailable';
          break;
        case error.TIMEOUT:
          message = 'Location request timed out';
          break;
      }
      setLocationError(message);
    };

    // Start watching position with high accuracy, real-time updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handlePositionError,
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0, // Always get fresh position
      }
    );

    // Cleanup on unmount or when pausing
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isReporting]);

  // When starting to report, set initial location
  useEffect(() => {
    if (isReporting && userLocation && !reportLocation) {
      onReportLocationChange([userLocation.lat, userLocation.lng]);
    }
  }, [isReporting, userLocation, reportLocation, onReportLocationChange]);

  // Check if map is far from user location (for recenter button)
  const checkRecenterVisibility = useCallback(() => {
    const currentUserLocation = userLocationRef.current;
    if (!mapRef.current || !currentUserLocation) {
      setShowRecenter(false);
      return;
    }

    const center = mapRef.current.getCenter();
    if (!center) return;

    const distance = calculateDistance(
      center.lat(),
      center.lng(),
      currentUserLocation.lat,
      currentUserLocation.lng
    );

    setShowRecenter(distance > 50); // Show if >50m from user
  }, []);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (isReporting && e.latLng) {
      onReportLocationChange([e.latLng.lat(), e.latLng.lng()]);
    }
  }, [isReporting, onReportLocationChange]);

  const handleMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      onReportLocationChange([e.latLng.lat(), e.latLng.lng()]);
    }
  }, [onReportLocationChange]);

  const handleCenterOnUser = useCallback(() => {
    const currentUserLocation = userLocationRef.current;
    if (currentUserLocation && mapRef.current) {
      mapRef.current.panTo(currentUserLocation);
      mapRef.current.setZoom(USER_LOCATION_ZOOM);
      setShowRecenter(false);
      // Save the new centre
      saveMapState(currentUserLocation.lat, currentUserLocation.lng, USER_LOCATION_ZOOM);
    }
  }, []);

  const handleCloseInfoWindow = useCallback(() => {
    setSelectedReport(null);
  }, []);

  // Handle map idle event - save position if moved significantly
  const handleMapIdle = useCallback(() => {
    checkRecenterVisibility();

    if (!mapRef.current) return;

    const center = mapRef.current.getCenter();
    const zoom = mapRef.current.getZoom();
    if (!center || zoom === undefined) return;

    const newLat = center.lat();
    const newLng = center.lng();

    // Check if center changed significantly (>0.001 lat/lng diff, roughly 100m)
    const lastCenter = lastSavedCenterRef.current;
    const hasMovedSignificantly = !lastCenter ||
      Math.abs(newLat - lastCenter.lat) > 0.001 ||
      Math.abs(newLng - lastCenter.lng) > 0.001;

    if (hasMovedSignificantly) {
      lastSavedCenterRef.current = { lat: newLat, lng: newLng };
      saveMapState(newLat, newLng, zoom);
    }
  }, [checkRecenterVisibility]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;

    // Initialise lastSavedCenterRef with current map center
    const center = map.getCenter();
    if (center) {
      lastSavedCenterRef.current = { lat: center.lat(), lng: center.lng() };
    }

    // Listen for map movement to show/hide recenter button and save position
    map.addListener('idle', handleMapIdle);
  }, [handleMapIdle]);

  const selectedReportData = reports.find(r => r.id === selectedReport);

  // Filter to only show active (unresolved, non-archived) reports on the map
  const activeReports = reports.filter(r => !r.resolved && !r.archived);

  // Show loading state while Google Maps loads
  if (loadError) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20">
        <div className="text-center p-4">
          <svg className="w-12 h-12 text-red-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-red-600 dark:text-red-400 font-medium">Failed to load map</p>
          <p className="text-red-500 dark:text-red-500 text-sm mt-1">Please check your internet connection</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-emerald-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4"></div>
          <p className="text-emerald-600 dark:text-emerald-400 font-medium">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {locationError && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 left-4 right-4 z-[1000] bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 px-4 py-3 rounded-lg shadow-lg text-sm"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {locationError}
          </div>
        </motion.div>
      )}

      <GoogleMap
          mapContainerStyle={containerStyle}
          center={mapCenter}
          zoom={mapZoom}
          onLoad={onMapLoad}
          onClick={handleMapClick}
          options={{
            disableDefaultUI: true,
            zoomControl: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: 'greedy', // Allow single-finger pan on mobile
            styles: [
              {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }],
              },
            ],
          }}
        >
          {/* Report markers with clustering */}
          <MarkerClusterer>
            {(clusterer) => (
              <>
                {activeReports.map((report) => (
                  <Marker
                    key={report.id}
                    position={{ lat: report.lat, lng: report.lng }}
                    icon={{
                      url: report.resolved ? resolvedIconUrl : ACTIVE_PIN_ICON,
                      scaledSize: new google.maps.Size(48, 44),
                      anchor: new google.maps.Point(24, 44),
                    }}
                    onClick={() => setSelectedReport(report.id)}
                    clusterer={clusterer}
                  />
                ))}
              </>
            )}
          </MarkerClusterer>

          {/* Info window for selected report */}
          {selectedReportData && (
            <InfoWindow
              position={{ lat: selectedReportData.lat, lng: selectedReportData.lng }}
              onCloseClick={handleCloseInfoWindow}
              options={{
                pixelOffset: new google.maps.Size(0, -44),
                disableAutoPan: false,
              }}
            >
              {isAdmin && onToggleResolved && onToggleFlagged && onToggleNoGlassFound ? (
                <AdminReportCard
                  report={selectedReportData}
                  onToggleResolved={onToggleResolved}
                  onToggleFlagged={onToggleFlagged}
                  onToggleNoGlassFound={onToggleNoGlassFound}
                />
              ) : (
                <ReportCard
                  report={selectedReportData}
                  onStillThere={onStillThere}
                  onCleared={onCleared}
                />
              )}
            </InfoWindow>
          )}

          {/* User location marker */}
          {userLocation && (
            <Marker
              position={userLocation}
              icon={{
                url: userIcon,
                scaledSize: new google.maps.Size(28, 28),
                anchor: new google.maps.Point(14, 14),
              }}
            />
          )}

          {/* Draggable pin for new reports */}
          {isReporting && reportLocation && (
            <Marker
              position={{ lat: reportLocation[0], lng: reportLocation[1] }}
              icon={{
                url: draggableIcon,
                scaledSize: new google.maps.Size(60, 80),
                anchor: new google.maps.Point(30, 76),
              }}
              draggable={true}
              onDragEnd={handleMarkerDragEnd}
              animation={google.maps.Animation.BOUNCE}
              zIndex={1000}
            />
          )}
        </GoogleMap>

      {/* Recenter button - shows when map is moved away from user location */}
      <AnimatePresence>
        {showRecenter && userLocation && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={handleCenterOnUser}
            className="absolute bottom-32 right-4 z-[1000] flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 rounded-full shadow-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-gray-700 transition-colors border border-emerald-200 dark:border-emerald-800"
            title="Recentre on my location"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v2m0 16v2M2 12h2m16 0h2" />
            </svg>
            <span className="text-sm font-medium">Recentre</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
