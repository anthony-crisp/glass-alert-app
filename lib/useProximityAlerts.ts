'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Report } from './db';
import { calculateDistance } from './utils';

// Constants
const ENTRY_RADIUS_METERS = 3; // ~10 feet
const EXIT_RADIUS_METERS = 6; // ~20 feet (buffer to prevent flicker)
const DEBOUNCE_MS = 1000; // Check every second for responsive real-time alerts
const SELF_REPORT_SUPPRESS_MS = 10 * 60 * 1000; // 10 minutes

interface ProximityAlertState {
  isInProximity: boolean;
  nearbyReportIds: string[];
  userLocation: { lat: number; lng: number } | null;
}

interface UseProximityAlertsProps {
  reports: Report[];
  enabled: boolean;
  suppressedReportIds: string[]; // Report IDs to ignore (self-reported)
  onAlertTriggered: (reportIds: string[]) => void;
  onAlertCleared: () => void;
}

export function useProximityAlerts({
  reports,
  enabled,
  suppressedReportIds,
  onAlertTriggered,
  onAlertCleared,
}: UseProximityAlertsProps) {
  const [state, setState] = useState<ProximityAlertState>({
    isInProximity: false,
    nearbyReportIds: [],
    userLocation: null,
  });

  const watchIdRef = useRef<number | null>(null);
  const lastCheckRef = useRef<number>(0);
  const previouslyInProximityRef = useRef<Set<string>>(new Set());
  const hasTriggeredAlertRef = useRef(false);

  // Request notification permission on mount
  useEffect(() => {
    if (enabled && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [enabled]);

  // Trigger vibration
  const triggerVibration = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  }, []);

  // Show browser notification
  const showNotification = useCallback(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      new Notification('PawSafe Alert', {
        body: 'Caution — Broken Glass Reported Ahead',
        icon: '/icons/icon-192x192.png',
        tag: 'proximity-alert', // Prevents duplicate notifications
        requireInteraction: false,
      });
    }
  }, []);

  // Check proximity to reports
  const checkProximity = useCallback((position: GeolocationPosition) => {
    const now = Date.now();

    // Debounce checks
    if (now - lastCheckRef.current < DEBOUNCE_MS) return;
    lastCheckRef.current = now;

    const { latitude, longitude } = position.coords;
    const userLoc = { lat: latitude, lng: longitude };

    // Filter active reports (not resolved, not archived)
    const activeReports = reports.filter(r => !r.resolved && !r.archived);

    // Find nearby reports (within entry or exit radius)
    const nearbyIds: string[] = [];
    const currentlyInProximity = new Set<string>();

    for (const report of activeReports) {
      // Skip suppressed reports (self-reported)
      if (suppressedReportIds.includes(report.id)) continue;

      const distance = calculateDistance(latitude, longitude, report.lat, report.lng);

      // Check if within entry radius
      if (distance <= ENTRY_RADIUS_METERS) {
        nearbyIds.push(report.id);
        currentlyInProximity.add(report.id);
      }
      // Check if was previously in proximity but now within exit radius (hysteresis)
      else if (distance <= EXIT_RADIUS_METERS && previouslyInProximityRef.current.has(report.id)) {
        nearbyIds.push(report.id);
        currentlyInProximity.add(report.id);
      }
    }

    // Determine if we just entered proximity (new reports)
    const newlyEntered = nearbyIds.filter(id => !previouslyInProximityRef.current.has(id));
    const justExited = nearbyIds.length === 0 && previouslyInProximityRef.current.size > 0;

    // Update previous proximity set
    previouslyInProximityRef.current = currentlyInProximity;

    // Update state
    setState({
      isInProximity: nearbyIds.length > 0,
      nearbyReportIds: nearbyIds,
      userLocation: userLoc,
    });

    // Trigger alerts on entry
    if (newlyEntered.length > 0 && !hasTriggeredAlertRef.current) {
      hasTriggeredAlertRef.current = true;
      triggerVibration();
      showNotification();
      onAlertTriggered(nearbyIds);
    }

    // Clear alert when exiting
    if (justExited) {
      hasTriggeredAlertRef.current = false;
      onAlertCleared();
    }
  }, [reports, suppressedReportIds, triggerVibration, showNotification, onAlertTriggered, onAlertCleared]);

  // Set up geolocation watch
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return;
    }

    // Start watching position with real-time updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      checkProximity,
      (error) => {
        console.warn('Proximity alert geolocation error:', error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0, // Always get fresh position for accurate proximity alerts
      }
    );

    // Cleanup on unmount
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, checkProximity]);

  // Reset alert state when disabled
  useEffect(() => {
    if (!enabled) {
      hasTriggeredAlertRef.current = false;
      previouslyInProximityRef.current = new Set();
      setState({
        isInProximity: false,
        nearbyReportIds: [],
        userLocation: null,
      });
    }
  }, [enabled]);

  return state;
}

// Helper to manage suppressed report IDs
export function useSuppressedReports() {
  const [suppressedIds, setSuppressedIds] = useState<string[]>([]);
  const suppressTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const suppressReport = useCallback((reportId: string) => {
    setSuppressedIds(prev => [...prev, reportId]);

    // Auto-remove after 10 minutes
    const timer = setTimeout(() => {
      setSuppressedIds(prev => prev.filter(id => id !== reportId));
      suppressTimers.current.delete(reportId);
    }, SELF_REPORT_SUPPRESS_MS);

    suppressTimers.current.set(reportId, timer);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      suppressTimers.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  return { suppressedIds, suppressReport };
}

// Helper for localStorage toggle
export function useProximityAlertsToggle() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('proximityAlertsEnabled');
    if (stored !== null) {
      setEnabled(stored === 'true');
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const newValue = !prev;
      localStorage.setItem('proximityAlertsEnabled', String(newValue));
      return newValue;
    });
  }, []);

  return { enabled, toggle, setEnabled };
}
