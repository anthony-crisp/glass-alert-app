'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface HeaderProps {
  showAdminLink?: boolean;
  onLogout?: () => void;
  proximityAlertsEnabled?: boolean;
  onToggleProximityAlerts?: () => void;
}

export default function Header({
  showAdminLink = false,
  onLogout,
  proximityAlertsEnabled = true,
  onToggleProximityAlerts,
}: HeaderProps) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDarkMode = savedTheme === 'dark' || (!savedTheme && prefersDark);
    setIsDark(isDarkMode);
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, []);

  const toggleDarkMode = () => {
    const newValue = !isDark;
    setIsDark(newValue);
    document.documentElement.classList.toggle('dark', newValue);
    localStorage.setItem('theme', newValue ? 'dark' : 'light');
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  if (!mounted) {
    return (
      <header className="fixed top-0 left-0 right-0 z-[1000] bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-emerald-100 dark:border-emerald-900">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl animate-pulse" />
            <div className="w-24 h-6 bg-emerald-100 rounded animate-pulse" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-[1000] bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-emerald-100 dark:border-emerald-900 safe-top">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="rounded-xl shadow-lg shadow-emerald-500/30 overflow-hidden"
          >
            <img
              src="/icons/icon-192x192.png"
              alt="PawSafe"
              className="w-9 h-9"
            />
          </motion.div>
          <div>
            <h1 className="text-xl text-emerald-800 dark:text-emerald-200" style={{ fontFamily: "'Cmas Play', cursive" }}>
              PawSafe
            </h1>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 -mt-1">
              Protecting Paws
            </p>
          </div>
        </Link>

        <div className="relative" ref={menuRef}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </motion.button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
              >
                <button
                  onClick={() => {
                    toggleDarkMode();
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {isDark ? (
                    <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                  {isDark ? 'Light Mode' : 'Dark Mode'}
                </button>

                {/* Proximity Alerts Toggle */}
                {onToggleProximityAlerts && (
                  <button
                    onClick={() => {
                      onToggleProximityAlerts();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-t border-gray-100 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <svg className={`w-5 h-5 ${proximityAlertsEnabled ? 'text-emerald-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v2" />
                      </svg>
                      <span className="whitespace-nowrap">Proximity Alerts</span>
                    </div>
                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${proximityAlertsEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${proximityAlertsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </button>
                )}

                {showAdminLink && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-t border-gray-100 dark:border-gray-700"
                  >
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Council View
                  </Link>
                )}

                {onLogout && (
                  <button
                    onClick={() => {
                      onLogout();
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors border-t border-gray-100 dark:border-gray-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
