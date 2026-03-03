'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  getRecordings, 
  deleteRecording, 
  downloadFile, 
  saveToDeviceGallery,
  SavedRecording,
  formatFileSize
} from '@/lib/localStorage';

interface MediaLibraryProps {
  onClose: () => void;
}

export default function MediaLibrary({ onClose }: MediaLibraryProps) {
  const [recordings, setRecordings] = useState<SavedRecording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<SavedRecording | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'video' | 'audio'>('all');

  useEffect(() => {
    setRecordings(getRecordings());
  }, []);

  const filteredRecordings = activeTab === 'all' 
    ? recordings 
    : recordings.filter(r => r.type === activeTab);

  const handleDelete = (id: string) => {
    deleteRecording(id);
    setRecordings(getRecordings());
    if (selectedRecording?.id === id) {
      setSelectedRecording(null);
    }
  };

  const handleDownload = async (recording: SavedRecording) => {
    const ext = recording.type === 'video' ? 'webm' : 'webm';
    const filename = `guardian_${recording.type}_${new Date(recording.timestamp).toISOString()}.${ext}`;
    await downloadFile(recording.dataUrl, filename);
  };

  const handleSaveToGallery = async (recording: SavedRecording) => {
    await saveToDeviceGallery(recording.dataUrl, recording.type);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-900 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">My Recordings</h2>
            <p className="text-gray-400 text-sm">{recordings.length} recordings saved</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-full transition-colors"
          >
            <span className="text-2xl">✕</span>
          </button>
        </div>

        <div className="flex gap-2 px-6 py-3 border-b border-gray-700">
          {(['all', 'video', 'audio'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {filteredRecordings.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">📁</div>
              <p className="text-lg">No recordings yet</p>
              <p className="text-sm">Your recordings will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRecordings.map(recording => (
                <motion.div
                  key={recording.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gray-800 rounded-xl overflow-hidden"
                >
                  {recording.type === 'video' ? (
                    <video
                      src={recording.dataUrl}
                      className="w-full h-40 object-cover"
                      controls
                    />
                  ) : (
                    <div className="h-40 bg-gray-700 flex items-center justify-center">
                      <audio
                        src={recording.dataUrl}
                        controls
                        className="w-full px-4"
                      />
                    </div>
                  )}
                  
                  <div className="p-3">
                    <p className="text-white text-sm font-medium">
                      {recording.type === 'video' ? '🎥 Video' : '🎤 Audio'}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {formatDate(recording.timestamp)}
                    </p>
                    {recording.location && (
                      <p className="text-gray-500 text-xs">
                        📍 {recording.location.latitude.toFixed(4)}, {recording.location.longitude.toFixed(4)}
                      </p>
                    )}
                    
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleDownload(recording)}
                        className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        ⬇ Download
                      </button>
                      <button
                        onClick={() => handleSaveToGallery(recording)}
                        className="flex-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors"
                      >
                        💾 Save
                      </button>
                      <button
                        onClick={() => handleDelete(recording.id)}
                        className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
