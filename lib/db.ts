import Dexie, { type EntityTable } from 'dexie';

export interface Confirmation {
  deviceId: string;
  timestamp: string;
}

export interface Report {
  id: string;
  lat: number;
  lng: number;
  desc: string;
  photoBase64?: string;
  photoUrl?: string; // Firebase Storage URL
  date: string;
  clearedCount: number;
  resolved: boolean;
  // New fields for confirmation tracking
  stillThereCount: number;
  stillThereConfirmations: Confirmation[];
  clearedConfirmations: Confirmation[];
  // New fields for sync
  syncStatus: 'synced' | 'pending' | 'conflict';
  lastModified: number;
  firebaseId?: string;
  // Archiving and moderation
  archived?: boolean;
  archivedAt?: number;
  flagged?: boolean;
  noGlassFound?: boolean;
}

const db = new Dexie('PawSafeDB') as Dexie & {
  reports: EntityTable<Report, 'id'>;
};

// Version 1: Original schema
db.version(1).stores({
  reports: 'id, lat, lng, date, resolved'
});

// Version 2: Add sync and confirmation fields
db.version(2).stores({
  reports: 'id, lat, lng, date, resolved, syncStatus'
}).upgrade(async (tx) => {
  // Migrate existing reports to include new fields
  await tx.table('reports').toCollection().modify((report) => {
    report.stillThereCount = report.stillThereCount ?? 0;
    report.stillThereConfirmations = report.stillThereConfirmations ?? [];
    report.clearedConfirmations = report.clearedConfirmations ?? [];
    report.syncStatus = report.syncStatus ?? 'pending';
    report.lastModified = report.lastModified ?? Date.now();
  });
});

// Version 3: Add archiving and moderation fields
db.version(3).stores({
  reports: 'id, lat, lng, date, resolved, syncStatus, archived, flagged'
}).upgrade(async (tx) => {
  await tx.table('reports').toCollection().modify((report) => {
    report.archived = report.archived ?? false;
    report.flagged = report.flagged ?? false;
  });
});

// Version 4: Add noGlassFound field
db.version(4).stores({
  reports: 'id, lat, lng, date, resolved, syncStatus, archived, flagged, noGlassFound'
}).upgrade(async (tx) => {
  await tx.table('reports').toCollection().modify((report) => {
    report.noGlassFound = report.noGlassFound ?? false;
  });
});

export { db };

// Helper functions for report operations
export async function getAllReports(): Promise<Report[]> {
  return await db.reports.toArray();
}

export async function getReport(id: string): Promise<Report | undefined> {
  return await db.reports.get(id);
}

export async function addReport(report: Omit<Report, 'stillThereCount' | 'stillThereConfirmations' | 'clearedConfirmations' | 'syncStatus' | 'lastModified'>): Promise<string> {
  const fullReport: Report = {
    ...report,
    stillThereCount: 0,
    stillThereConfirmations: [],
    clearedConfirmations: [],
    syncStatus: 'pending',
    lastModified: Date.now(),
  };
  return await db.reports.add(fullReport);
}

export async function updateReport(id: string, updates: Partial<Report>): Promise<number> {
  return await db.reports.update(id, {
    ...updates,
    lastModified: Date.now(),
    syncStatus: 'pending',
  });
}

// Check if device has already confirmed cleared
export function hasDeviceConfirmedCleared(report: Report, deviceId: string): boolean {
  return report.clearedConfirmations?.some(c => c.deviceId === deviceId) ?? false;
}

// Check if device has confirmed still there recently (within 24 hours)
export function hasDeviceConfirmedStillThereRecently(report: Report, deviceId: string): boolean {
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  return report.stillThereConfirmations?.some(
    c => c.deviceId === deviceId && new Date(c.timestamp).getTime() > oneDayAgo
  ) ?? false;
}

export async function incrementClearedCount(
  id: string,
  deviceId: string
): Promise<{ success: boolean; alreadyConfirmed: boolean }> {
  const report = await db.reports.get(id);
  if (!report) return { success: false, alreadyConfirmed: false };

  // Check if this device has already confirmed
  if (hasDeviceConfirmedCleared(report, deviceId)) {
    return { success: false, alreadyConfirmed: true };
  }

  const newConfirmations = [
    ...(report.clearedConfirmations || []),
    { deviceId, timestamp: new Date().toISOString() }
  ];
  const newCount = newConfirmations.length;

  await db.reports.update(id, {
    clearedCount: newCount,
    clearedConfirmations: newConfirmations,
    resolved: newCount >= 3,
    lastModified: Date.now(),
    syncStatus: 'pending',
  });

  return { success: true, alreadyConfirmed: false };
}

export async function incrementStillThereCount(
  id: string,
  deviceId: string
): Promise<{ success: boolean; alreadyConfirmed: boolean }> {
  const report = await db.reports.get(id);
  if (!report) return { success: false, alreadyConfirmed: false };

  // Check if this device has confirmed recently (24 hour cooldown)
  if (hasDeviceConfirmedStillThereRecently(report, deviceId)) {
    return { success: false, alreadyConfirmed: true };
  }

  const newConfirmations = [
    ...(report.stillThereConfirmations || []),
    { deviceId, timestamp: new Date().toISOString() }
  ];
  const newStillThereCount = newConfirmations.length;

  // If 2+ people confirm still there, reset cleared progress
  const shouldResetCleared = newStillThereCount >= 2;

  await db.reports.update(id, {
    stillThereCount: newStillThereCount,
    stillThereConfirmations: newConfirmations,
    // Reset cleared count if enough people confirm still there
    clearedCount: shouldResetCleared ? 0 : report.clearedCount,
    clearedConfirmations: shouldResetCleared ? [] : report.clearedConfirmations,
    resolved: false, // Un-resolve if someone confirms still there
    lastModified: Date.now(),
    syncStatus: 'pending',
  });

  return { success: true, alreadyConfirmed: false };
}

export async function markAsResolved(id: string): Promise<void> {
  await db.reports.update(id, {
    resolved: true,
    lastModified: Date.now(),
    syncStatus: 'pending',
  });
}

export async function bulkMarkResolved(ids: string[]): Promise<void> {
  const now = Date.now();
  await db.reports.bulkUpdate(
    ids.map(id => ({
      key: id,
      changes: {
        resolved: true,
        lastModified: now,
        syncStatus: 'pending' as const,
      }
    }))
  );
}

export async function deleteReport(id: string): Promise<void> {
  await db.reports.delete(id);
}

// Get reports pending sync
export async function getPendingReports(): Promise<Report[]> {
  return await db.reports.where('syncStatus').equals('pending').toArray();
}

// Mark reports as synced
export async function markAsSynced(ids: string[], firebaseIds?: Record<string, string>): Promise<void> {
  for (const id of ids) {
    await db.reports.update(id, {
      syncStatus: 'synced',
      firebaseId: firebaseIds?.[id],
    });
  }
}

// Get active (non-archived) reports
export async function getActiveReports(): Promise<Report[]> {
  const all = await db.reports.toArray();
  return all.filter(r => !r.archived);
}

// Archive a report
export async function archiveReport(id: string): Promise<void> {
  await db.reports.update(id, {
    archived: true,
    archivedAt: Date.now(),
    lastModified: Date.now(),
    syncStatus: 'pending',
  });
}

// Unarchive a report
export async function unarchiveReport(id: string): Promise<void> {
  await db.reports.update(id, {
    archived: false,
    archivedAt: undefined,
    lastModified: Date.now(),
    syncStatus: 'pending',
  });
}

// Toggle flagged status
export async function toggleFlagged(id: string): Promise<boolean> {
  const report = await db.reports.get(id);
  if (!report) return false;

  const newFlagged = !report.flagged;
  await db.reports.update(id, {
    flagged: newFlagged,
    lastModified: Date.now(),
    syncStatus: 'pending',
  });
  return newFlagged;
}

export async function toggleNoGlassFound(id: string): Promise<boolean> {
  const report = await db.reports.get(id);
  if (!report) return false;

  const newNoGlassFound = !report.noGlassFound;
  await db.reports.update(id, {
    noGlassFound: newNoGlassFound,
    lastModified: Date.now(),
    syncStatus: 'pending',
  });
  return newNoGlassFound;
}

// Auto-archive resolved reports older than 7 days
export async function autoArchiveOldResolvedReports(): Promise<number> {
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const reports = await db.reports.toArray();

  const toArchive = reports.filter(r =>
    r.resolved &&
    !r.archived &&
    r.lastModified < sevenDaysAgo
  );

  for (const report of toArchive) {
    await archiveReport(report.id);
  }

  return toArchive.length;
}
