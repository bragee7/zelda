'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import EmergencyCard from '@/components/EmergencyCard';
import { subscribeToActiveEmergencies, Emergency, resolveEmergency } from '@/lib/firestore';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-100 animate-pulse rounded-2xl" />
});

export default function Dashboard() {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setLoading(true);
    
    const unsubscribe = subscribeToActiveEmergencies((data) => {
      setEmergencies(data);
      setLoading(false);
      setLastUpdated(new Date());
      setIsRefreshing(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setLoading(true);
    window.location.reload();
  }, []);

  const handleMarkerClick = useCallback((id: string) => {
    setHighlightedId(id);
    setTimeout(() => setHighlightedId(null), 5000);
  }, []);

  const handleResolve = useCallback((id: string) => {
    console.log('Emergency resolved:', id);
  }, []);

  const activeCount = emergencies.length;
  const highPriorityCount = emergencies.filter(e => e.aiPriority === 'HIGH').length;

  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Never';
    return lastUpdated.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="bg-gray-900 text-white px-6 py-4 shadow-lg">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🚔</span>
            <div>
              <h1 className="text-xl font-bold">Police Dashboard</h1>
              <p className="text-gray-400 text-sm">Guardian Voice Emergency Monitor</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-gray-700 px-4 py-2 rounded-full hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <motion.span
                animate={isRefreshing ? { rotate: 360 } : {}}
                transition={isRefreshing ? { repeat: Infinity, duration: 1 } : {}}
                className="text-lg"
              >
                🔄
              </motion.span>
              <span className="text-sm">
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </span>
            </button>

            {/* Last Updated */}
            <div className="text-xs text-gray-400">
              Updated: {formatLastUpdated()}
            </div>

            {/* Active Count */}
            <div className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-full">
              <span className="text-2xl">🔴</span>
              <span className="font-bold text-lg">{activeCount}</span>
              <span className="text-gray-400 text-sm">Active</span>
            </div>
            
            {highPriorityCount > 0 && (
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="flex items-center gap-2 bg-red-600 px-4 py-2 rounded-full"
              >
                <span className="text-2xl">⚠️</span>
                <span className="font-bold text-lg">{highPriorityCount}</span>
                <span className="text-white text-sm">High Priority</span>
              </motion.div>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4">
        <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-100px)]">
          {/* Emergency Cards List */}
          <div className="lg:w-1/3 flex flex-col">
            <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                  <span>📋</span>
                  Active Emergencies
                  <span className="ml-2 bg-gray-100 px-3 py-1 rounded-full text-sm">
                    {emergencies.length}
                  </span>
                </h2>
                
                {loading && (
                  <span className="text-sm text-gray-400">Loading...</span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-2xl p-4 shadow animate-pulse">
                      <div className="h-6 bg-gray-200 rounded w-20 mb-3"></div>
                      <div className="h-4 bg-gray-100 rounded w-full mb-2"></div>
                      <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                    </div>
                  ))}
                </div>
              ) : emergencies.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">✓</div>
                  <p className="text-lg font-medium">No Active Emergencies</p>
                  <p className="text-sm">All quiet on the front</p>
                </div>
              ) : (
                <AnimatePresence>
                  {emergencies.map(emergency => (
                    <EmergencyCard
                      key={emergency.id}
                      emergency={emergency}
                      isHighlighted={highlightedId === emergency.id}
                      onResolve={handleResolve}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Map */}
          <div className="lg:w-2/3">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden h-full">
              <MapView
                emergencies={emergencies}
                highlightedId={highlightedId}
                onMarkerClick={handleMarkerClick}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-full shadow-lg text-sm">
        <span className="text-gray-400">Legend:</span>
        <span className="mx-2 text-red-500">● HIGH</span>
        <span className="mx-2 text-orange-500">● MEDIUM</span>
        <span className="mx-2 text-yellow-500">● LOW</span>
        <span className="mx-2 text-green-500">● RESOLVED</span>
      </div>

      {/* Info Banner */}
      {emergencies.length > 0 && (
        <div className="fixed bottom-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          📹 {emergencies.filter(e => e.videoUrl).length} with video
          🎤 {emergencies.filter(e => e.audioUrl).length} with audio
        </div>
      )}
    </main>
  );
}
