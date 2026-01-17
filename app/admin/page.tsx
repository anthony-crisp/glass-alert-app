'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Flag, Archive, ArchiveRestore, SearchX } from 'lucide-react';
import Header from '@/components/Header';
import { Report, getAllReports, bulkMarkResolved, toggleFlagged, toggleNoGlassFound, archiveReport, unarchiveReport } from '@/lib/db';
import { formatDate } from '@/lib/utils';

// Dynamically import Map for admin view
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-emerald-50 dark:bg-gray-900">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-200 border-t-emerald-600"></div>
    </div>
  ),
});

const ADMIN_PASSWORD = 'council123';

function AdminContent() {
  const searchParams = useSearchParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'resolved' | 'archived' | 'flagged' | 'noGlassFound'>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Auto-authenticate if ?admin=true is in URL
  useEffect(() => {
    if (searchParams.get('admin') === 'true') {
      setIsAuthenticated(true);
    }
  }, [searchParams]);

  // Load reports
  useEffect(() => {
    const loadReports = async () => {
      try {
        const storedReports = await getAllReports();
        setReports(storedReports);
      } catch (error) {
        console.error('Failed to load reports:', error);
      } finally {
        setIsLoading(false);
      }
    };
    if (isAuthenticated) {
      loadReports();
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const filteredReports = reports.filter(report => {
    if (filterStatus === 'active') return !report.resolved && !report.archived;
    if (filterStatus === 'resolved') return report.resolved && !report.archived;
    if (filterStatus === 'archived') return report.archived;
    if (filterStatus === 'flagged') return report.flagged;
    if (filterStatus === 'noGlassFound') return report.noGlassFound;
    // 'all' shows non-archived by default
    return !report.archived;
  });

  const handleSelectAll = () => {
    if (selectedReports.size === filteredReports.length) {
      setSelectedReports(new Set());
    } else {
      setSelectedReports(new Set(filteredReports.map(r => r.id)));
    }
  };

  const handleSelectReport = (id: string) => {
    const newSelected = new Set(selectedReports);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedReports(newSelected);
  };

  const handleBulkMarkCleaned = async () => {
    if (selectedReports.size === 0) return;

    try {
      await bulkMarkResolved(Array.from(selectedReports));
      setReports(prev =>
        prev.map(r =>
          selectedReports.has(r.id) ? { ...r, resolved: true } : r
        )
      );
      setSelectedReports(new Set());
      toast.success(`Marked ${selectedReports.size} reports as cleaned`);
    } catch (error) {
      console.error('Failed to mark reports as cleaned:', error);
      toast.error('Failed to update reports');
    }
  };

  const handleToggleFlagged = async (id: string) => {
    try {
      const newFlagged = await toggleFlagged(id);
      setReports(prev =>
        prev.map(r =>
          r.id === id ? { ...r, flagged: newFlagged } : r
        )
      );
      toast.success(newFlagged ? 'Report flagged for review' : 'Flag removed');
    } catch (error) {
      console.error('Failed to toggle flag:', error);
      toast.error('Failed to update flag');
    }
  };

  const handleToggleNoGlassFound = async (id: string) => {
    try {
      const newNoGlassFound = await toggleNoGlassFound(id);
      setReports(prev =>
        prev.map(r =>
          r.id === id ? { ...r, noGlassFound: newNoGlassFound } : r
        )
      );
      toast.success(newNoGlassFound ? 'Marked as no glass found' : 'No glass found removed');
    } catch (error) {
      console.error('Failed to toggle no glass found:', error);
      toast.error('Failed to update status');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await archiveReport(id);
      setReports(prev =>
        prev.map(r =>
          r.id === id ? { ...r, archived: true, archivedAt: Date.now() } : r
        )
      );
      toast.success('Report archived');
    } catch (error) {
      console.error('Failed to archive:', error);
      toast.error('Failed to archive report');
    }
  };

  const handleUnarchive = async (id: string) => {
    try {
      await unarchiveReport(id);
      setReports(prev =>
        prev.map(r =>
          r.id === id ? { ...r, archived: false, archivedAt: undefined } : r
        )
      );
      toast.success('Report unarchived');
    } catch (error) {
      console.error('Failed to unarchive:', error);
      toast.error('Failed to unarchive report');
    }
  };

  // Placeholder handlers for map (admin doesn't need these actions)
  const handleStillThere = useCallback(() => {}, []);
  const handleCleared = useCallback(() => {}, []);

  // Toggle resolved status for map view
  const handleToggleResolved = useCallback(async (id: string) => {
    try {
      const report = reports.find(r => r.id === id);
      if (!report) return;

      const newResolved = !report.resolved;
      await bulkMarkResolved(newResolved ? [id] : []); // This only marks as resolved

      // For toggling off, we need direct update
      if (!newResolved) {
        const { db } = await import('@/lib/db');
        await db.reports.update(id, {
          resolved: false,
          lastModified: Date.now(),
          syncStatus: 'pending',
        });
      }

      setReports(prev =>
        prev.map(r =>
          r.id === id ? { ...r, resolved: newResolved } : r
        )
      );
      toast.success(newResolved ? 'Marked as cleared' : 'Marked as active');
    } catch (error) {
      console.error('Failed to toggle resolved:', error);
      toast.error('Failed to update status');
    }
  }, [reports]);

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-emerald-50 dark:bg-gray-900">
        <Header isAdmin />
        <div className="pt-[80px] px-4 flex items-center justify-center min-h-screen">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8"
          >
            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Council Access
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                Enter the council password to access the admin dashboard
              </p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError(false);
                  }}
                  placeholder="Enter council password"
                  className={`w-full px-4 py-3 rounded-xl border ${
                    passwordError
                      ? 'border-red-300 dark:border-red-600 focus:ring-red-500'
                      : 'border-gray-200 dark:border-gray-700 focus:ring-emerald-500'
                  } bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:border-transparent transition-all`}
                />
                {passwordError && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-sm text-red-600 dark:text-red-400"
                  >
                    Incorrect password. Please try again.
                  </motion.p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
              >
                Access Dashboard
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/"
                className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Back to Map
              </Link>
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-6">
              Demo password: council123
            </p>
          </motion.div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-emerald-50 dark:bg-gray-900">
      <Header isAdmin onLogout={() => setIsAuthenticated(false)} />
      <div className="pt-[70px] pb-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Council Dashboard
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                Manage glass hazard reports in your area
              </p>
            </div>

            <Link
              href="/"
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Back to Map
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{reports.length}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {reports.filter(r => !r.resolved && !r.archived).length}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400">Resolved</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {reports.filter(r => r.resolved && !r.archived).length}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400">Archived</p>
              <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                {reports.filter(r => r.archived).length}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400">Flagged</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {reports.filter(r => r.flagged).length}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400">No Glass</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {reports.filter(r => r.noGlassFound).length}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400">Selected</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {selectedReports.size}
              </p>
            </motion.div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                List View
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'map'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Map View
              </button>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                className="pl-4 pr-10 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%236b7280%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
              >
                <option value="all">All Reports</option>
                <option value="active">Active Only</option>
                <option value="resolved">Resolved Only</option>
                <option value="archived">Archived</option>
                <option value="flagged">Flagged</option>
                <option value="noGlassFound">No Glass Found</option>
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {selectedReports.size > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={handleBulkMarkCleaned}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Mark {selectedReports.size} as Cleaned
                </motion.button>
              )}
            </div>
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            {viewMode === 'list' ? (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600"></div>
                  </div>
                ) : filteredReports.length === 0 ? (
                  <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl">
                    <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-gray-500 dark:text-gray-400">No reports found</p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                    {/* Table header */}
                    <div className="hidden md:grid md:grid-cols-[auto,1fr,auto,auto,auto,auto,auto] gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedReports.size === filteredReports.length && filteredReports.length > 0}
                          onChange={handleSelectAll}
                          className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </div>
                      <div>Description</div>
                      <div>Date</div>
                      <div>Status</div>
                      <div>Cleared</div>
                      <div>Actions</div>
                      <div></div>
                    </div>

                    {/* Table rows */}
                    {filteredReports.map((report, index) => (
                      <motion.div
                        key={report.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`grid grid-cols-1 md:grid-cols-[auto,1fr,auto,auto,auto,auto,auto] gap-4 px-4 py-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors ${
                          report.archived ? 'opacity-50' : report.resolved ? 'opacity-70' : ''
                        }`}
                      >
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedReports.has(report.id)}
                            onChange={() => handleSelectReport(report.id)}
                            className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="flex items-start gap-3">
                          {(report.photoBase64 || report.photoUrl) && (
                            <img
                              src={report.photoUrl || report.photoBase64}
                              alt=""
                              className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                            />
                          )}
                          <div className="flex flex-col">
                            <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
                              {report.desc || 'Broken glass hazard'}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {report.flagged && (
                                <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                  <Flag className="w-3 h-3" /> Flagged
                                </span>
                              )}
                              {report.noGlassFound && (
                                <span className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                  <SearchX className="w-3 h-3" /> No Glass Found
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {formatDate(report.date)}
                        </div>
                        <div>
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            report.archived
                              ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                              : report.resolved
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                          }`}>
                            {report.archived ? 'Archived' : report.resolved ? 'Resolved' : 'Active'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                          {report.clearedCount}/3
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleFlagged(report.id)}
                            className={`p-3 rounded-xl transition-colors ${
                              report.flagged
                                ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400'
                            }`}
                            title={report.flagged ? 'Remove flag' : 'Flag for review'}
                          >
                            <Flag className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleToggleNoGlassFound(report.id)}
                            className={`p-3 rounded-xl transition-colors ${
                              report.noGlassFound
                                ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400'
                            }`}
                            title={report.noGlassFound ? 'Remove no glass found' : 'No glass found'}
                          >
                            <SearchX className="w-5 h-5" />
                          </button>
                          {report.archived ? (
                            <button
                              onClick={() => handleUnarchive(report.id)}
                              className="p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors"
                              title="Unarchive"
                            >
                              <ArchiveRestore className="w-5 h-5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleArchive(report.id)}
                              className="p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition-colors"
                              title="Archive"
                            >
                              <Archive className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="map"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-[500px] bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden"
              >
                <Map
                  reports={filteredReports}
                  onStillThere={handleStillThere}
                  onCleared={handleCleared}
                  isReporting={false}
                  reportLocation={null}
                  onReportLocationChange={() => {}}
                  isAdmin={true}
                  onToggleResolved={handleToggleResolved}
                  onToggleFlagged={handleToggleFlagged}
                  onToggleNoGlassFound={handleToggleNoGlassFound}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-emerald-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600"></div>
      </main>
    }>
      <AdminContent />
    </Suspense>
  );
}
