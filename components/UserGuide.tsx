'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface UserGuideProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

export default function UserGuide({ isOpen, onClose, isAdmin = false }: UserGuideProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[3000]"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md sm:w-full bg-white dark:bg-gray-900 rounded-2xl shadow-2xl z-[3001] overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {isAdmin ? 'Admin Guide' : 'How to Use PawSafe'}
              </h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isAdmin ? (
                // Admin Guide Content
                <>
                  <GuideSection
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    }
                    title="Managing Reports"
                    color="emerald"
                  >
                    <p>Use <strong>List View</strong> for detailed management or <strong>Map View</strong> to see report locations. Filter reports by status using the dropdown.</p>
                  </GuideSection>

                  <GuideSection
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    }
                    title="Mark as Cleared"
                    color="green"
                  >
                    <p>When a hazard has been cleaned up, mark it as <strong>Cleared</strong>. This removes it from the active hazards shown to public users.</p>
                  </GuideSection>

                  <GuideSection
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                      </svg>
                    }
                    title="No Glass Found"
                    color="purple"
                  >
                    <p>If you investigate a report and find no glass, mark it as <strong>No Glass Found</strong>. This helps identify false positives.</p>
                  </GuideSection>

                  <GuideSection
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                      </svg>
                    }
                    title="Flag for Review"
                    color="amber"
                  >
                    <p>Flag reports that need attention, seem suspicious, or require follow-up investigation.</p>
                  </GuideSection>

                  <GuideSection
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    }
                    title="Statistics"
                    color="blue"
                  >
                    <p>The stats bar shows total reports, active hazards, cleared, flagged, and no glass found counts at a glance.</p>
                  </GuideSection>
                </>
              ) : (
                // Public Guide Content
                <>
                  <GuideSection
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    }
                    title="Report a Hazard"
                    color="emerald"
                  >
                    <p>Tap the <strong>+</strong> button to report broken glass. Place the pin on the map, add a description and optional photo, then submit.</p>
                  </GuideSection>

                  <GuideSection
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    }
                    title="View Hazards"
                    color="amber"
                  >
                    <p>Yellow warning markers show active hazards. Tap a marker to see details, photos, and community feedback.</p>
                  </GuideSection>

                  <GuideSection
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    }
                    title="Community Reporting"
                    color="blue"
                  >
                    <p>Help verify reports! Tap <strong>"Still There"</strong> if you see the glass, or <strong>"It's Cleared"</strong> if it's gone. After 3 cleared confirmations, the hazard is marked as resolved.</p>
                  </GuideSection>

                  <GuideSection
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0" />
                      </svg>
                    }
                    title="Proximity Alerts"
                    color="red"
                  >
                    <p>When enabled, you'll receive a <strong>vibration and notification</strong> when you're within 3 metres of a reported hazard. Toggle this in the menu.</p>
                  </GuideSection>

                  <GuideSection
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    }
                    title="Real-Time Sync"
                    color="green"
                  >
                    <p>Reports sync across all devices in real-time. Works offline too — your reports will sync when you're back online.</p>
                  </GuideSection>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors"
              >
                Got it!
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Helper component for guide sections
function GuideSection({
  icon,
  title,
  color,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: 'emerald' | 'amber' | 'blue' | 'red' | 'green' | 'purple';
  children: React.ReactNode;
}) {
  const colorClasses = {
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="flex gap-3">
      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
        <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
