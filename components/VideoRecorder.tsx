'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VideoRecorderProps {
  onVideoRecorded: (videoDataUrl: string, duration: number) => void;
  maxDuration?: number;
}

type RecordingState = 'idle' | 'preview' | 'recording' | 'processing' | 'recorded';

export default function VideoRecorder({ 
  onVideoRecorded, 
  maxDuration = 30 
}: VideoRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(maxDuration);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setRecordingState('preview');
    } catch (err) {
      console.error('Camera error:', err);
      setError('Camera access denied. Please allow camera permissions.');
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [stream]);

  const startRecording = useCallback(() => {
    if (!stream) return;

    chunksRef.current = [];
    setCountdown(maxDuration);

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9,opus'
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        onVideoRecorded(dataUrl, maxDuration);
        setRecordingState('recorded');
      };
      reader.readAsDataURL(blob);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000);
    setRecordingState('recording');

    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          stopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stream, maxDuration, onVideoRecorded]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecordingState('processing');
  }, []);

  const toggleCamera = useCallback(() => {
    if (recordingState === 'preview') {
      stopCamera();
      setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
      setTimeout(() => startCamera(), 100);
    }
  }, [recordingState, startCamera, stopCamera]);

  const reset = useCallback(() => {
    stopCamera();
    setRecordingState('idle');
    setCountdown(maxDuration);
  }, [stopCamera, maxDuration]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const getStatusColor = () => {
    switch (recordingState) {
      case 'recording':
        return 'bg-red-500';
      case 'processing':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="flex flex-col items-center">
      <AnimatePresence mode="wait">
        {recordingState === 'idle' && (
          <motion.button
            key="start-btn"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={startCamera}
            className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 shadow-2xl flex items-center justify-center hover:scale-105 transition-transform"
          >
            <div className="text-white text-center">
              <div className="text-4xl mb-2">🎥</div>
              <div className="text-sm font-medium">Start Video</div>
            </div>
          </motion.button>
        )}

        {(recordingState === 'preview' || recordingState === 'recording') && (
          <motion.div
            key="preview"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-black">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-80 h-60 object-cover"
              />
              
              {recordingState === 'recording' && (
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <motion.div
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-4 h-4 bg-red-500 rounded-full"
                  />
                  <span className="text-white font-bold bg-black/50 px-2 py-1 rounded">
                    {countdown}s
                  </span>
                </div>
              )}

              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                {recordingState === 'preview' && (
                  <>
                    <button
                      onClick={toggleCamera}
                      className="p-3 bg-white/20 backdrop-blur rounded-full hover:bg-white/30 transition-colors"
                      title="Switch Camera"
                    >
                      <span className="text-white text-xl">🔄</span>
                    </button>
                    
                    <button
                      onClick={startRecording}
                      className="p-4 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                    >
                      <span className="text-white text-2xl">⏺</span>
                    </button>
                    
                    <button
                      onClick={reset}
                      className="p-3 bg-white/20 backdrop-blur rounded-full hover:bg-white/30 transition-colors"
                      title="Cancel"
                    >
                      <span className="text-white text-xl">✕</span>
                    </button>
                  </>
                )}

                {recordingState === 'recording' && (
                  <button
                    onClick={stopRecording}
                    className="p-4 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
                  >
                    <span className="text-white text-2xl">⏹</span>
                  </button>
                )}
              </div>
            </div>

            <p className="mt-4 text-gray-400 text-sm">
              {recordingState === 'preview' 
                ? 'Tap record to start 30-second video capture' 
                : 'Recording...'}
            </p>
          </motion.div>
        )}

        {recordingState === 'processing' && (
          <motion.div
            key="processing"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center"
          >
            <div className={`w-32 h-32 rounded-full ${getStatusColor()} shadow-2xl flex items-center justify-center`}>
              <span className="text-4xl">⏳</span>
            </div>
            <p className="mt-4 text-white">Processing video...</p>
          </motion.div>
        )}

        {recordingState === 'recorded' && (
          <motion.div
            key="recorded"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center"
          >
            <div className="w-32 h-32 rounded-full bg-green-500 shadow-2xl flex items-center justify-center">
              <span className="text-4xl">✓</span>
            </div>
            <p className="mt-4 text-green-400 font-medium">Video Recorded!</p>
            <button
              onClick={reset}
              className="mt-4 px-6 py-2 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors"
            >
              Record Another
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-xl max-w-md text-center"
        >
          {error}
        </motion.div>
      )}
    </div>
  );
}
