'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import MediaCapture from '@/components/MediaCapture';
import OfflineIndicator from '@/components/OfflineIndicator';
import MediaLibrary from '@/components/MediaLibrary';
import { getRecordings } from '@/lib/localStorage';

const MapView = dynamic(() => import('@/components/MapView'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-100 animate-pulse rounded-2xl" />
});

export default function Home() {
  const [emergencyTriggered, setEmergencyTriggered] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [recordingsCount, setRecordingsCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      const recordings = getRecordings();
      setRecordingsCount(recordings.length);
    };
    
    updateCount();
    const interval = setInterval(updateCount, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <OfflineIndicator />
      
      {/* My Recordings Button */}
      <button
        onClick={() => setShowMediaLibrary(true)}
        className="fixed top-20 right-4 z-40 px-4 py-3 bg-purple-600 text-white rounded-xl shadow-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
      >
        <span className="text-xl">📁</span>
        <div className="flex flex-col items-start">
          <span className="font-semibold">My Recordings</span>
          <span className="text-xs text-purple-200">{recordingsCount} saved</span>
        </div>
      </button>

      {/* Media Library Modal */}
      <AnimatePresence>
        {showMediaLibrary && (
          <MediaLibrary onClose={() => setShowMediaLibrary(false)} />
        )}
      </AnimatePresence>
      
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-3 mb-2"
          >
            <span className="text-4xl">🛡️</span>
            <h1 className="text-4xl font-bold text-white">Guardian Voice</h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 text-lg"
          >
            AI-Powered Emergency Response System
          </motion.p>
        </header>

        <AnimatePresence mode="wait">
          {!emergencyTriggered ? (
            <motion.div
              key="media-capture"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl">
                <MediaCapture onEmergencyTriggered={() => setEmergencyTriggered(true)} onOpenRecordings={() => setShowMediaLibrary(true)} />
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white/10 backdrop-blur rounded-xl p-4 text-center"
                >
                  <div className="text-2xl mb-2">🎥</div>
                  <p className="text-gray-300 text-sm">Video Recording (30s)</p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white/10 backdrop-blur rounded-xl p-4 text-center"
                >
                  <div className="text-2xl mb-2">🎤</div>
                  <p className="text-gray-300 text-sm">Audio Recording</p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-white/10 backdrop-blur rounded-xl p-4 text-center"
                >
                  <div className="text-2xl mb-2">📍</div>
                  <p className="text-gray-300 text-sm">Live Location Tracking</p>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
                  <div className="text-2xl mb-2">💾</div>
                  <p className="text-gray-300 text-sm">Offline Storage (50MB)</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
                  <div className="text-2xl mb-2">🔄</div>
                  <p className="text-gray-300 text-sm">Auto-Sync When Online</p>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="success-screen"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-32 h-32 mx-auto mb-6 bg-green-500 rounded-full flex items-center justify-center"
              >
                <span className="text-6xl">✓</span>
              </motion.div>
              
              <h2 className="text-3xl font-bold text-white mb-4">Emergency Alerted!</h2>
              <p className="text-gray-300 mb-6">
                Your emergency has been transmitted to emergency services.
                Stay calm and stay safe.
              </p>

              <div className="bg-white/10 backdrop-blur rounded-2xl p-6 mb-6">
                <p className="text-gray-400 text-sm mb-2">What was captured:</p>
                <ul className="text-gray-300 text-left space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    Video evidence (30 seconds)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    Audio recording
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    Live location captured
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    AI priority analysis in progress
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    Saved to your device
                  </li>
                  {typeof window !== 'undefined' && !navigator.onLine && (
                    <li className="flex items-center gap-2">
                      <span className="text-yellow-400">⏳</span>
                      Data saved offline - will sync when online
                    </li>
                  )}
                </ul>
              </div>

              <button
                onClick={() => setEmergencyTriggered(false)}
                className="px-8 py-3 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors"
              >
                Return to Home
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="text-center mt-12 text-gray-500 text-sm">
          <p>Guardian Voice - Protecting lives with AI technology</p>
          <p className="mt-1">
            <a href="/dashboard" className="hover:text-gray-300 underline">
              Police Dashboard
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
