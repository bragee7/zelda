'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import offlineStorage from '@/lib/offlineStorage';

interface OfflineIndicatorProps {
  onSyncComplete?: (count: number) => void;
}

export default function OfflineIndicator({ onSyncComplete }: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const checkPendingUploads = useCallback(async () => {
    try {
      await offlineStorage.init();
      const count = await offlineStorage.getPendingCount();
      setPendingCount(count);
    } catch (error) {
      console.error('Failed to check pending uploads:', error);
    }
  }, []);

  const syncPendingUploads = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      const uploads = await offlineStorage.getAllPending();
      let syncedCount = 0;

      for (const upload of uploads) {
        try {
          await offlineStorage.updateUpload(upload.id, { status: 'uploading' });
          
          if (upload.type === 'location' && upload.location) {
            await uploadLocationToFirestore(upload.location);
          } else if (upload.type === 'audio' || upload.type === 'video') {
            await uploadMediaToFirestore(upload);
          }

          await offlineStorage.updateUpload(upload.id, { status: 'uploaded' });
          await offlineStorage.deleteUpload(upload.id);
          syncedCount++;
        } catch (error) {
          console.error('Failed to sync upload:', upload.id, error);
          await offlineStorage.updateUpload(upload.id, { 
            status: 'failed',
            retryCount: upload.retryCount + 1 
          });
        }
      }

      if (syncedCount > 0) {
        setLastSyncTime(new Date());
        onSyncComplete?.(syncedCount);
      }

      await checkPendingUploads();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, checkPendingUploads, onSyncComplete]);

  const uploadLocationToFirestore = async (location: any) => {
    const { db } = await import('@/lib/firebase');
    const { collection, addDoc, Timestamp } = await import('firebase/firestore');
    
    await addDoc(collection(db, 'location_updates'), {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      timestamp: Timestamp.fromMillis(location.timestamp),
      syncedAt: Timestamp.now(),
    });
  };

  const uploadMediaToFirestore = async (upload: any) => {
    console.log('Would upload media to Firestore:', upload.type, upload.data.length);
  };

  useEffect(() => {
    setIsOnline(navigator.onLine);
    checkPendingUploads();

    const handleOnline = () => {
      setIsOnline(true);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
      syncPendingUploads();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(checkPendingUploads, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkPendingUploads, syncPendingUploads]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <>
      <div className="fixed top-4 right-4 z-50">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`
            flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-lg
            ${isOnline 
              ? 'bg-green-500/20 border border-green-500/30' 
              : 'bg-red-500/20 border border-red-500/30'
            }
          `}
        >
          <motion.div
            animate={isSyncing ? { rotate: 360 } : {}}
            transition={isSyncing ? { repeat: Infinity, duration: 1 } : {}}
            className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}
          />
          
          <div className="flex flex-col">
            <span className="text-white font-medium text-sm">
              {isSyncing 
                ? 'Syncing...' 
                : isOnline 
                  ? 'Online' 
                  : 'Offline'
              }
            </span>
            
            {pendingCount > 0 && (
              <span className="text-gray-300 text-xs">
                {pendingCount} pending upload{pendingCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {pendingCount > 0 && isOnline && !isSyncing && (
            <button
              onClick={syncPendingUploads}
              className="ml-2 px-3 py-1 bg-white/20 rounded-full text-white text-xs hover:bg-white/30 transition-colors"
            >
              Sync Now
            </button>
          )}
        </motion.div>

        <AnimatePresence>
          {showNotification && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`
                mt-2 px-4 py-2 rounded-lg text-sm text-white text-center
                ${isOnline 
                  ? 'bg-green-600' 
                  : 'bg-red-600'
                }
              `}
            >
              {isOnline 
                ? 'Internet restored! Syncing data...' 
                : 'No internet connection. Data saved locally.'
              }
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {lastSyncTime && (
        <div className="fixed bottom-4 right-4 text-gray-400 text-xs">
          Last sync: {formatTime(lastSyncTime)}
        </div>
      )}
    </>
  );
}
