'use client';

import { motion } from 'framer-motion';
import { Emergency, resolveEmergency } from '@/lib/firestore';
import { useState } from 'react';

interface EmergencyCardProps {
  emergency: Emergency;
  isHighlighted?: boolean;
  onResolve?: (id: string) => void;
}

const priorityConfig = {
  HIGH: {
    color: 'bg-red-500',
    text: 'text-red-700',
    border: 'border-red-300',
    label: 'HIGH',
  },
  MEDIUM: {
    color: 'bg-orange-500',
    text: 'text-orange-700',
    border: 'border-orange-300',
    label: 'MEDIUM',
  },
  LOW: {
    color: 'bg-yellow-500',
    text: 'text-yellow-700',
    border: 'border-yellow-300',
    label: 'LOW',
  },
  RESOLVED: {
    color: 'bg-green-500',
    text: 'text-green-700',
    border: 'border-green-300',
    label: 'RESOLVED',
  },
};

export default function EmergencyCard({ 
  emergency, 
  isHighlighted = false,
  onResolve 
}: EmergencyCardProps) {
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [isAudioLoading, setIsAudioLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [audioError, setAudioError] = useState(false);

  const config = priorityConfig[emergency.status === 'RESOLVED' ? 'RESOLVED' : emergency.aiPriority];

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const handleResolve = async () => {
    if (onResolve && emergency.status === 'ACTIVE') {
      try {
        await resolveEmergency(emergency.id);
        onResolve(emergency.id);
      } catch (error) {
        console.error('Failed to resolve emergency:', error);
      }
    }
  };

  const hasMedia = emergency.videoUrl || emergency.audioUrl;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      whileHover={{ scale: 1.01 }}
      className={`
        relative p-4 rounded-2xl bg-white shadow-lg border-2 transition-all
        ${isHighlighted ? `${config.border} ring-2 ring-offset-2 ${config.border}` : 'border-gray-100'}
        ${emergency.aiPriority === 'HIGH' && emergency.status === 'ACTIVE' ? 'animate-pulse-urgent' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1 rounded-full text-white text-xs font-bold ${config.color}`}>
            {config.label}
          </span>
          <span className="text-gray-500 text-sm">
            {formatTime(emergency.createdAt)}
          </span>
        </div>
        
        {emergency.status === 'ACTIVE' && (
          <button
            onClick={handleResolve}
            className="px-3 py-1 bg-green-500 text-white text-sm font-medium rounded-full hover:bg-green-600 transition-colors"
          >
            Resolve
          </button>
        )}
      </div>

      {/* Location - Clickable Google Maps Link */}
      <div className="flex items-center gap-2 text-gray-600 mb-2">
        <span className="text-lg">📍</span>
        {emergency.googleMapsUrl ? (
          <a
            href={emergency.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium flex items-center gap-1"
          >
            🗺️ Open in Google Maps
          </a>
        ) : (
          <span className="text-sm">
            {emergency.latitude.toFixed(6)}, {emergency.longitude.toFixed(6)}
          </span>
        )}
        {emergency.locationAccuracy && (
          <span className="text-xs text-gray-400">
            (±{Math.round(emergency.locationAccuracy)}m)
          </span>
        )}
      </div>

      {/* Device Info */}
      <div className="flex items-center gap-2 text-gray-600 mb-3">
        <span className="text-lg">📱</span>
        <span className="text-xs truncate" title={emergency.deviceInfo}>
          {emergency.deviceInfo.length > 35 
            ? emergency.deviceInfo.substring(0, 35) + '...' 
            : emergency.deviceInfo}
        </span>
      </div>

      {/* Media Section */}
      {hasMedia && (
        <div className="space-y-3 mt-4">
          {/* Video */}
          {emergency.videoUrl && !videoError && (
            <div className="rounded-xl overflow-hidden bg-gray-900">
              {isVideoLoading && (
                <div className="h-32 flex items-center justify-center bg-gray-800">
                  <div className="text-gray-400 text-sm">Loading video...</div>
                </div>
              )}
              <video
                src={emergency.videoUrl}
                controls
                className="w-full h-40 object-cover"
                onLoadedData={() => setIsVideoLoading(false)}
                onError={() => {
                  setVideoError(true);
                  setIsVideoLoading(false);
                }}
              />
            </div>
          )}

          {videoError && (
            <div className="h-32 flex items-center justify-center bg-gray-100 rounded-xl">
              <span className="text-gray-400 text-sm">Video unavailable</span>
            </div>
          )}

          {/* Audio */}
          {emergency.audioUrl && !audioError && (
            <div className="p-3 bg-gray-50 rounded-xl">
              {isAudioLoading && (
                <div className="text-gray-400 text-xs mb-2">Loading audio...</div>
              )}
              <audio
                src={emergency.audioUrl}
                controls
                className="w-full h-10"
                onLoadedData={() => setIsAudioLoading(false)}
                onError={() => {
                  setAudioError(true);
                  setIsAudioLoading(false);
                }}
              />
            </div>
          )}

          {audioError && (
            <div className="p-3 bg-gray-100 rounded-xl">
              <span className="text-gray-400 text-sm">Audio unavailable</span>
            </div>
          )}
        </div>
      )}

      {/* AI Analysis */}
      {emergency.aiReason && (
        <div className="mt-3 p-2 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">AI Analysis:</p>
          <p className={`text-sm ${config.text} font-medium`}>
            {emergency.aiReason}
          </p>
        </div>
      )}

      {/* No Media Indicator */}
      {!hasMedia && (
        <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
          <p className="text-yellow-700 text-sm">
            ⚠️ No media evidence attached
          </p>
        </div>
      )}
    </motion.div>
  );
}
