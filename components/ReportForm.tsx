'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
import { compressImage } from '@/lib/utils';

interface ReportFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (desc: string, photoBase64?: string) => void;
  location: [number, number] | null;
}

export default function ReportForm({ isOpen, onClose, onSubmit, location }: ReportFormProps) {
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCustomizingLocation, setIsCustomizingLocation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragControls = useDragControls();

  // Handle drag end - close if dragged down enough
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      if (isCustomizingLocation) {
        setIsCustomizingLocation(false);
      } else {
        onClose();
      }
    }
  };

  // Reset customizing state when form closes
  const handleClose = () => {
    setIsCustomizingLocation(false);
    onClose();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('Photo must be less than 10MB');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const compressed = await compressImage(file, 800, 0.7);
      setPhoto(compressed);
    } catch {
      setError('Failed to process photo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) {
      setError('Please select a location on the map');
      return;
    }

    onSubmit(description, photo || undefined);

    // Reset form
    setDescription('');
    setPhoto(null);
    setError(null);
    setIsCustomizingLocation(false);
    onClose();
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - transparent when customizing location */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isCustomizingLocation ? 0 : 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[2000]"
            onClick={isCustomizingLocation ? undefined : handleClose}
            style={{ pointerEvents: isCustomizingLocation ? 'none' : 'auto' }}
          />

          {/* Collapsed location customization bar */}
          <AnimatePresence>
            {isCustomizingLocation && (
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-[2002] bg-gradient-to-t from-amber-500 to-amber-400 p-4 pb-20 safe-bottom rounded-t-3xl shadow-2xl"
              >
                <div className="flex flex-col items-center gap-3">
                  {/* Live location display */}
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                    <span className="text-white font-medium text-sm">
                      {location
                        ? `${location[0].toFixed(5)}, ${location[1].toFixed(5)}`
                        : 'Drag the pin to set location'}
                    </span>
                  </div>

                  <p className="text-white/90 text-sm text-center">
                    Drag the orange pin on the map to set the exact hazard location
                  </p>

                  <div className="flex flex-col items-center gap-2 w-full max-w-xs">
                    <button
                      type="button"
                      onClick={() => setIsCustomizingLocation(false)}
                      className="w-full py-3 bg-white hover:bg-gray-50 text-amber-600 font-semibold rounded-xl shadow-lg transition-colors text-base"
                    >
                      Confirm Location
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomizingLocation(false);
                        onClose();
                      }}
                      className="py-2 text-white/90 hover:text-white font-medium text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Modal - collapsed when customizing */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{
              opacity: isCustomizingLocation ? 0 : 1,
              y: isCustomizingLocation ? '100%' : 0,
              scale: isCustomizingLocation ? 0.95 : 1,
            }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            drag={isCustomizingLocation ? false : "y"}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            className="fixed bottom-0 left-0 right-0 z-[2001] bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl max-h-[85vh] overflow-auto safe-bottom"
            style={{ pointerEvents: isCustomizingLocation ? 'none' : 'auto' }}
          >
            {/* Drag handle area */}
            <div
              className="sticky top-0 bg-white dark:bg-gray-900 pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={(e) => !isCustomizingLocation && dragControls.start(e)}
            >
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors" />
            </div>

            <form onSubmit={handleSubmit} className="p-6 pt-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Report Glass Hazard
                </h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Location info with Customise button */}
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm font-medium">
                      {location
                        ? `${location[0].toFixed(5)}, ${location[1].toFixed(5)}`
                        : 'Tap the map to set location'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Customise Location button */}
              <button
                type="button"
                onClick={() => setIsCustomizingLocation(true)}
                className="w-full mb-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/30 transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Customise Location
              </button>

              {/* Description */}
              <div className="mb-4">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="E.g., Broken bottle on corner near bus stop, covers about 1m area"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none transition-all"
                />
              </div>

              {/* Photo upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Photo (optional)
                </label>

                {!photo ? (
                  <div className="relative">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors">
                      {isLoading ? (
                        <div className="flex items-center justify-center">
                          <svg className="animate-spin h-8 w-8 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                      ) : (
                        <>
                          <svg className="w-10 h-10 mx-auto text-gray-400 dark:text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Tap to take or choose a photo
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden">
                    <img
                      src={photo}
                      alt="Preview"
                      className="w-full h-48 object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Error message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm"
                >
                  {error}
                </motion.div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={!location}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-300 dark:disabled:from-gray-700 dark:disabled:to-gray-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/30 disabled:shadow-none"
              >
                Submit Report
              </button>

              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
                Your report helps keep dog walkers safe. Thank you!
              </p>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
