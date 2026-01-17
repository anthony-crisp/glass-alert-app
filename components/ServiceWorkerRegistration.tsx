'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('PawSafe: Service Worker registered with scope:', registration.scope);
        })
        .catch((error) => {
          console.error('PawSafe: Service Worker registration failed:', error);
        });
    }
  }, []);

  return null;
}
