'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface ProximityAlertProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export default function ProximityAlert({ isVisible, onDismiss }: ProximityAlertProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed top-16 left-0 right-0 z-[1500] px-4"
        >
          <div className="bg-amber-300 border-2 border-amber-500 rounded-xl shadow-lg shadow-amber-500/30">
            <div className="flex items-center gap-3 p-4">
              {/* Warning icon */}
              <div className="flex-shrink-0 p-2 bg-amber-400 rounded-full">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              {/* Alert text */}
              <div className="flex-1">
                <p className="text-black font-bold text-base">
                  Caution — Broken Glass Reported Ahead
                </p>
              </div>

              {/* Dismiss button */}
              <button
                onClick={onDismiss}
                className="flex-shrink-0 p-2 text-black/70 hover:text-black hover:bg-amber-400 rounded-full transition-colors"
                aria-label="Dismiss alert"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
