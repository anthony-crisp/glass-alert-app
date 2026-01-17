'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Header from '@/components/Header';
import ReportForm from '@/components/ReportForm';
import ProximityAlert from '@/components/ProximityAlert';
import { Report, getActiveReports, addReport, incrementClearedCount, incrementStillThereCount, autoArchiveOldResolvedReports } from '@/lib/db';
import { generateId, getOrCreateDeviceId } from '@/lib/utils';
import { initializeSync, syncPendingToFirestore, testFirebaseConnection } from '@/lib/sync';
import { useProximityAlerts, useSuppressedReports, useProximityAlertsToggle } from '@/lib/useProximityAlerts';

// Dynamically import Map to avoid SSR issues with Google Maps
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-emerald-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4"></div>
        <p className="text-emerald-600 dark:text-emerald-400 font-medium">Loading map...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isReporting, setIsReporting] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportLocation, setReportLocation] = useState<[number, number] | null>(null);
  const [showProximityAlert, setShowProximityAlert] = useState(false);
  const [proximityAlertDismissed, setProximityAlertDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Track if sync has been initialized
  const syncInitialized = useRef(false);

  // Proximity alerts system
  const { enabled: proximityAlertsEnabled, toggle: toggleProximityAlerts } = useProximityAlertsToggle();
  const { suppressedIds, suppressReport } = useSuppressedReports();

  // Handle proximity alert callbacks
  const handleProximityAlertTriggered = useCallback(() => {
    if (!proximityAlertDismissed) {
      setShowProximityAlert(true);
    }
  }, [proximityAlertDismissed]);

  const handleProximityAlertCleared = useCallback(() => {
    setShowProximityAlert(false);
    setProximityAlertDismissed(false);
  }, []);

  // Use the proximity alerts hook
  useProximityAlerts({
    reports,
    enabled: proximityAlertsEnabled,
    suppressedReportIds: suppressedIds,
    onAlertTriggered: handleProximityAlertTriggered,
    onAlertCleared: handleProximityAlertCleared,
  });

  // Load reports and initialize sync
  useEffect(() => {
    if (syncInitialized.current) return;
    syncInitialized.current = true;

    const handleReportsUpdate = (updatedReports: Report[]) => {
      // Filter to only show active (non-archived) reports
      const active = updatedReports.filter(r => !r.archived);
      setReports(active);
      setIsLoading(false);
    };

    // Test Firebase connection first
    testFirebaseConnection().then(isConnected => {
      if (isConnected) {
        console.log('Firebase connection verified');
        toast.success('Connected to cloud sync', { duration: 2000 });
      } else {
        console.warn('Firebase connection failed');
        toast.error('Cloud sync unavailable - using local storage only');
      }
    });

    // Initialize sync - this handles both local and Firebase data
    const cleanup = initializeSync(handleReportsUpdate);

    // Also load local reports immediately for fast initial render
    getActiveReports().then(localReports => {
      if (localReports.length > 0) {
        setReports(localReports);
        setIsLoading(false);
      }
    });

    // Auto-archive old resolved reports
    autoArchiveOldResolvedReports().then(count => {
      if (count > 0) {
        console.log(`Auto-archived ${count} old resolved reports`);
      }
    });

    return cleanup;
  }, []);

  // Handle report submission
  const handleSubmitReport = useCallback(async (desc: string, photoBase64?: string) => {
    if (!reportLocation) return;

    const reportId = generateId();
    const newReport = {
      id: reportId,
      lat: reportLocation[0],
      lng: reportLocation[1],
      desc,
      photoBase64,
      date: new Date().toISOString(),
      clearedCount: 0,
      resolved: false,
    };

    try {
      await addReport(newReport);

      // Suppress proximity alerts for this newly created report (prevents self-alert)
      suppressReport(reportId);

      // Reload reports to get the full report with all fields
      const updatedReports = await getActiveReports();
      setReports(updatedReports);
      setIsReporting(false);
      setShowReportForm(false);
      setReportLocation(null);

      toast.success('Hazard reported! Thank you for helping keep paws safe.');

      // Sync to Firebase in the background
      syncPendingToFirestore().catch(err => {
        console.error('Background sync failed:', err);
        toast.error('Failed to sync - will retry when online');
      });
    } catch (error) {
      console.error('Failed to save report:', error);
      toast.error('Failed to save report. Please try again.');
    }
  }, [reportLocation, suppressReport]);

  // Handle "Still There" button
  const handleStillThere = useCallback(async (id: string) => {
    const deviceId = getOrCreateDeviceId();
    try {
      const result = await incrementStillThereCount(id, deviceId);

      if (result.alreadyConfirmed) {
        toast('You already reported this recently', { icon: '⏰' });
        return;
      }

      if (result.success) {
        // Reload reports to get updated state
        const updatedReports = await getActiveReports();
        setReports(updatedReports);
        toast.success('Thanks for confirming the hazard is still there');

        // Sync to Firebase in the background
        syncPendingToFirestore().catch(err => {
          console.error('Background sync failed:', err);
        });
      }
    } catch (error) {
      console.error('Failed to confirm still there:', error);
      toast.error('Failed to update. Please try again.');
    }
  }, []);

  // Handle "Cleared" button
  const handleCleared = useCallback(async (id: string) => {
    const deviceId = getOrCreateDeviceId();
    try {
      const result = await incrementClearedCount(id, deviceId);

      if (result.alreadyConfirmed) {
        toast('You already confirmed this hazard', { icon: '✓' });
        return;
      }

      if (result.success) {
        // Reload reports to get updated state
        const updatedReports = await getActiveReports();
        setReports(updatedReports);
        toast.success('Thanks for confirming! Hazard will be cleared after 3 confirmations.');

        // Sync to Firebase in the background
        syncPendingToFirestore().catch(err => {
          console.error('Background sync failed:', err);
        });
      }
    } catch (error) {
      console.error('Failed to update report:', error);
      toast.error('Failed to update. Please try again.');
    }
  }, []);

  // Start reporting
  const handleStartReport = () => {
    setIsReporting(true);
    setShowReportForm(true);
  };

  // Cancel reporting
  const handleCancelReport = () => {
    setIsReporting(false);
    setShowReportForm(false);
    setReportLocation(null);
  };

  return (
    <main className="h-screen h-[100dvh] flex flex-col bg-emerald-50 dark:bg-gray-900">
      <Header
        showAdminLink
        proximityAlertsEnabled={proximityAlertsEnabled}
        onToggleProximityAlerts={toggleProximityAlerts}
      />

      {/* Map container */}
      <div className="flex-1 pt-[60px] relative">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4"></div>
              <p className="text-emerald-600 dark:text-emerald-400 font-medium">Loading...</p>
            </div>
          </div>
        ) : (
          <Map
            reports={reports}
            onStillThere={handleStillThere}
            onCleared={handleCleared}
            isReporting={isReporting}
            reportLocation={reportLocation}
            onReportLocationChange={setReportLocation}
          />
        )}

        {/* Reporting mode indicator */}
        <AnimatePresence>
          {isReporting && !showReportForm && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-44 left-4 right-4 z-[1000]"
            >
              <div className="bg-amber-100 dark:bg-amber-900/80 rounded-xl p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-200 dark:bg-amber-800 rounded-lg">
                    <svg className="w-5 h-5 text-amber-700 dark:text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Tap the map to place pin
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Or drag the pin to adjust location
                    </p>
                  </div>
                  <button
                    onClick={() => setShowReportForm(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating action button */}
        <AnimatePresence mode="wait">
          {!isReporting ? (
            <motion.button
              key="add-button"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleStartReport}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[1000] w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 rounded-full shadow-lg shadow-emerald-500/40 flex items-center justify-center text-white transition-all safe-bottom"
              aria-label="Report broken glass"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </motion.button>
          ) : (
            <motion.button
              key="cancel-button"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleCancelReport}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[1000] w-16 h-16 bg-gray-500 hover:bg-gray-600 rounded-full shadow-lg flex items-center justify-center text-white transition-all safe-bottom"
              aria-label="Cancel report"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Report form modal */}
      <ReportForm
        isOpen={showReportForm}
        onClose={handleCancelReport}
        onSubmit={handleSubmitReport}
        location={reportLocation}
      />

      {/* Proximity alert */}
      <ProximityAlert
        isVisible={showProximityAlert}
        onDismiss={() => {
          setShowProximityAlert(false);
          setProximityAlertDismissed(true);
        }}
      />
    </main>
  );
}
