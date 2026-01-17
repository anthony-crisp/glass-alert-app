import {
  ref,
  set,
  update,
  remove,
  get,
  onValue,
  serverTimestamp,
  DataSnapshot,
} from 'firebase/database';
import { database } from './firebase-config';
import { db, Report, getAllReports, markAsSynced, getPendingReports } from './db';
import toast from 'react-hot-toast';

const REPORTS_PATH = 'reports';

// Convert local Report to Realtime Database format
function toRealtimeDbReport(report: Report): Record<string, unknown> {
  const dbData: Record<string, unknown> = {
    id: report.id,
    lat: report.lat,
    lng: report.lng,
    desc: report.desc || '',
    date: report.date,
    clearedCount: report.clearedCount || 0,
    resolved: report.resolved || false,
    stillThereCount: report.stillThereCount || 0,
    stillThereConfirmations: report.stillThereConfirmations || [],
    clearedConfirmations: report.clearedConfirmations || [],
    updatedAt: serverTimestamp(),
    archived: report.archived || false,
    flagged: report.flagged || false,
  };

  // Only add optional fields if they exist
  if (report.photoBase64) {
    dbData.photoBase64 = report.photoBase64;
  }
  if (report.photoUrl) {
    dbData.photoUrl = report.photoUrl;
  }
  if (report.archivedAt) {
    dbData.archivedAt = report.archivedAt;
  }

  return dbData;
}

// Convert Realtime Database data to local Report
function fromRealtimeDbReport(data: Record<string, unknown>, id: string): Report {
  return {
    id: (data.id as string) || id,
    lat: data.lat as number,
    lng: data.lng as number,
    desc: data.desc as string,
    photoBase64: data.photoBase64 as string | undefined,
    photoUrl: data.photoUrl as string | undefined,
    date: data.date as string,
    clearedCount: (data.clearedCount as number) || 0,
    resolved: (data.resolved as boolean) || false,
    stillThereCount: (data.stillThereCount as number) || 0,
    stillThereConfirmations: (data.stillThereConfirmations as Report['stillThereConfirmations']) || [],
    clearedConfirmations: (data.clearedConfirmations as Report['clearedConfirmations']) || [],
    syncStatus: 'synced',
    lastModified: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
    firebaseId: id,
    archived: (data.archived as boolean) || false,
    archivedAt: data.archivedAt as number | undefined,
    flagged: (data.flagged as boolean) || false,
  };
}

// Sync a single report to Realtime Database
export async function syncReportToFirestore(report: Report): Promise<string> {
  console.log('Syncing report to Realtime Database:', report.id);

  try {
    const reportRef = ref(database, `${REPORTS_PATH}/${report.id}`);
    const dbData = toRealtimeDbReport(report);
    console.log('Realtime DB data to write:', JSON.stringify(dbData, null, 2));

    await set(reportRef, dbData);
    console.log('Synced report to Realtime Database:', report.id);
    return report.id;
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('Error syncing report to Realtime Database:', error);
    console.error('Error code:', err.code);
    console.error('Error message:', err.message);

    // Show specific error messages
    if (err.code === 'PERMISSION_DENIED' || err.message?.includes('permission')) {
      toast.error('Firebase permission denied. Check Realtime Database rules.');
    } else if (err.code === 'NETWORK_ERROR') {
      toast.error('Network error. Check your internet connection.');
    } else {
      toast.error(`Firebase error: ${err.message || 'Unknown error'}`);
    }
    throw error;
  }
}

// Sync all pending reports to Realtime Database
export async function syncPendingToFirestore(): Promise<void> {
  const pendingReports = await getPendingReports();
  console.log('Pending reports to sync:', pendingReports.length);

  if (pendingReports.length === 0) {
    console.log('No pending reports to sync');
    return;
  }

  const firebaseIds: Record<string, string> = {};
  const syncedIds: string[] = [];
  const errors: string[] = [];

  for (const report of pendingReports) {
    try {
      const firebaseId = await syncReportToFirestore(report);
      firebaseIds[report.id] = firebaseId;
      syncedIds.push(report.id);
    } catch (error) {
      console.error(`Failed to sync report ${report.id}:`, error);
      errors.push(report.id);
    }
  }

  if (syncedIds.length > 0) {
    await markAsSynced(syncedIds, firebaseIds);
    console.log('Marked as synced:', syncedIds.length, 'reports');
  }

  if (errors.length > 0) {
    toast.error(`Failed to sync ${errors.length} report(s). Check console for details.`);
  } else if (syncedIds.length > 0) {
    console.log('All pending reports synced successfully');
  }
}

// Fetch all reports from Realtime Database
export async function fetchFromFirestore(): Promise<Report[]> {
  console.log('Fetching reports from Realtime Database...');
  try {
    const reportsRef = ref(database, REPORTS_PATH);
    const snapshot = await get(reportsRef);

    if (!snapshot.exists()) {
      console.log('No reports found in Realtime Database');
      return [];
    }

    const data = snapshot.val();
    const reports: Report[] = [];

    for (const [id, reportData] of Object.entries(data)) {
      reports.push(fromRealtimeDbReport(reportData as Record<string, unknown>, id));
    }

    console.log('Fetched', reports.length, 'reports from Realtime Database');
    return reports;
  } catch (error) {
    console.error('Error fetching from Realtime Database:', error);
    throw error;
  }
}

// Merge remote reports with local, preferring the most recently modified
export async function mergeReports(
  localReports: Report[],
  remoteReports: Report[]
): Promise<Report[]> {
  const merged = new Map<string, Report>();

  // Add all local reports first
  for (const report of localReports) {
    merged.set(report.id, report);
  }

  // Merge remote reports, preferring newer versions
  for (const remoteReport of remoteReports) {
    const localReport = merged.get(remoteReport.id);

    if (!localReport) {
      // New report from remote, add it
      merged.set(remoteReport.id, remoteReport);
    } else {
      // Compare timestamps, use the newer one
      const localTime = localReport.lastModified || 0;
      const remoteTime = remoteReport.lastModified || 0;

      if (remoteTime > localTime) {
        merged.set(remoteReport.id, {
          ...remoteReport,
          syncStatus: 'synced',
        });
      } else if (localTime > remoteTime && localReport.syncStatus === 'pending') {
        // Local is newer and needs to be pushed
        merged.set(remoteReport.id, localReport);
      }
    }
  }

  return Array.from(merged.values());
}

// Full sync: pull from Realtime Database, merge, push pending changes
export async function fullSync(): Promise<Report[]> {
  console.log('Starting full sync...');
  try {
    // 1. Fetch remote reports
    const remoteReports = await fetchFromFirestore();
    console.log('Remote reports:', remoteReports.length);

    // 2. Get local reports
    const localReports = await getAllReports();
    console.log('Local reports:', localReports.length);

    // 3. Merge
    const mergedReports = await mergeReports(localReports, remoteReports);
    console.log('Merged reports:', mergedReports.length);

    // 4. Save merged reports to local DB
    for (const report of mergedReports) {
      await db.reports.put(report);
    }

    // 5. Push any pending changes
    await syncPendingToFirestore();

    console.log('Full sync completed');
    return mergedReports;
  } catch (error) {
    console.error('Full sync failed:', error);
    toast.error('Sync failed. Using local data only.');
    // Return local reports on failure
    return getAllReports();
  }
}

// Initialize sync with real-time updates
export function initializeSync(onReportsUpdate: (reports: Report[]) => void): () => void {
  let unsubscribe: (() => void) | null = null;

  const handleOnline = async () => {
    console.log('Online: Starting sync...');
    try {
      const reports = await fullSync();
      onReportsUpdate(reports);
    } catch (error) {
      console.error('Sync on online failed:', error);
    }
  };

  const handleOffline = () => {
    console.log('Offline: Using local data only');
    toast('You are offline. Changes will sync when back online.', { icon: '📡' });
  };

  // Set up real-time listener for Realtime Database changes
  const setupRealtimeListener = () => {
    console.log('Setting up Realtime Database listener...');
    const reportsRef = ref(database, REPORTS_PATH);

    const callback = async (snapshot: DataSnapshot) => {
      console.log('Realtime Database update received');

      if (!navigator.onLine) {
        console.log('Offline, skipping remote update');
        return;
      }

      const remoteReports: Report[] = [];

      if (snapshot.exists()) {
        const data = snapshot.val();
        for (const [id, reportData] of Object.entries(data)) {
          remoteReports.push(fromRealtimeDbReport(reportData as Record<string, unknown>, id));
        }
      }

      console.log('Received', remoteReports.length, 'reports from real-time update');

      const localReports = await getAllReports();
      const merged = await mergeReports(localReports, remoteReports);

      // Update local DB
      for (const report of merged) {
        await db.reports.put(report);
      }

      onReportsUpdate(merged);
    };

    // onValue returns an unsubscribe function
    unsubscribe = onValue(reportsRef, callback, (error) => {
      console.error('Realtime Database listener error:', error);
      toast.error('Real-time sync error. Please refresh the page.');
    });

    console.log('Realtime Database listener set up');
  };

  // Initial sync
  if (navigator.onLine) {
    handleOnline();
    setupRealtimeListener();
  } else {
    getAllReports().then(onReportsUpdate);
  }

  // Listen for online/offline events
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (unsubscribe) {
      unsubscribe();
    }
  };
}

// Delete a report from Realtime Database
export async function deleteReportFromFirestore(reportId: string): Promise<void> {
  const reportRef = ref(database, `${REPORTS_PATH}/${reportId}`);
  await remove(reportRef);
}

// Test Firebase Realtime Database connection
export async function testFirebaseConnection(): Promise<boolean> {
  try {
    console.log('Testing Firebase Realtime Database connection...');
    const reportsRef = ref(database, REPORTS_PATH);
    const snapshot = await get(reportsRef);
    const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
    console.log('Firebase Realtime Database connection successful! Documents:', count);
    return true;
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('Firebase Realtime Database connection test failed:', error);
    console.error('Error code:', err.code);
    console.error('Error message:', err.message);

    // Give specific guidance based on error
    if (err.code === 'PERMISSION_DENIED' || err.message?.includes('permission')) {
      console.error('REALTIME DB RULES: You need to update your Realtime Database security rules.');
      console.error('Go to Firebase Console > Realtime Database > Rules and set:');
      console.error('{ "rules": { ".read": true, ".write": true } }');
    }
    return false;
  }
}

// Update a single field in a report (useful for quick updates)
export async function updateReportField(
  reportId: string,
  updates: Partial<Report>
): Promise<void> {
  const reportRef = ref(database, `${REPORTS_PATH}/${reportId}`);
  await update(reportRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}
