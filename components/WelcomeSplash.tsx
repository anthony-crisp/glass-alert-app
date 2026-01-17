'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function WelcomeSplash() {
  const [showSplash, setShowSplash] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hasSeenWelcome = localStorage.getItem('pawsafe-welcome-seen');
    if (!hasSeenWelcome) {
      setShowSplash(true);
    }
  }, []);

  const handleDismiss = () => {
    setShowSplash(false);
    localStorage.setItem('pawsafe-welcome-seen', 'true');
  };

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {showSplash && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[2000] bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-900 flex flex-col items-center justify-center p-8 overflow-hidden"
        >
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
            className="relative max-w-sm w-full flex flex-col items-center"
          >
            {/* Logo */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 150, damping: 15 }}
              className="w-28 h-28 rounded-[2rem] mb-6 shadow-2xl overflow-hidden"
            >
              <img
                src="/icons/icon-512x512.png"
                alt="PawSafe"
                className="w-full h-full"
              />
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="text-5xl text-white tracking-tight mb-2"
              style={{ fontFamily: "'Cmas Play', cursive" }}
            >
              PawSafe
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="text-emerald-100 text-xl mb-10 text-center"
              style={{ fontFamily: "'Cmas Play', cursive" }}
            >
              Keep paws safe on every walk{' '}
              <img src="/icons/icon-192x192.png" alt="" className="w-6 h-6 inline-block align-middle rounded" />
            </motion.p>

            {/* Description card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="w-full bg-white/10 backdrop-blur-md rounded-3xl p-6 mb-8 border border-white/10 shadow-xl"
            >
              <div className="space-y-5 text-center">
                <p className="text-white/95 leading-relaxed text-[15px]">
                  Broken glass on pavements can ruin a day (or a paw) in seconds.
                </p>

                <p className="text-white/95 leading-relaxed text-[15px]">
                  Spot some? Tap{' '}
                  <span className="inline-flex items-center justify-center w-7 h-7 bg-white/25 rounded-full text-sm font-bold mx-0.5 align-middle shadow-inner">
                    +
                  </span>
                  {' '}to report in 5 seconds — precise location, optional photo, done.
                </p>

                <p className="text-white/95 leading-relaxed text-[15px]">
                  Together we clear the paths for every dog in town.
                </p>
              </div>
            </motion.div>

            {/* Welcome message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-white text-2xl mb-10"
              style={{ fontFamily: "'Cmas Play', cursive" }}
            >
              Welcome to the pack <span className="text-red-400 text-3xl align-middle">❤</span>
            </motion.p>

            {/* CTA Button */}
            <motion.button
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              whileHover={{ scale: 1.03, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDismiss}
              className="w-full py-4 bg-white text-emerald-700 font-bold text-lg rounded-2xl shadow-xl hover:bg-emerald-50 transition-all duration-200"
            >
              Let's Go
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
