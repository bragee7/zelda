'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadAudio, uploadVideo } from '@/lib/storage';
import { createEmergency, updateEmergencyPriority } from '@/lib/firestore';
import { locationTracker, LocationData } from '@/lib/locationTracker';
import offlineStorage, { PendingUpload } from '@/lib/offlineStorage';
import { 
  saveRecordingToDevice, 
  SavedRecording, 
  saveBlobDirectly, 
  blobToDataUrl,
  isMobile 
} from '@/lib/localStorage';

type CaptureMode = 'idle' | 'recording_video' | 'recording_audio' | 'processing' | 'complete';
type RecordType = 'video' | 'audio' | 'sos';

interface CapturedMedia {
  audioDataUrl: string;
  videoDataUrl: string;
  audioBlob?: Blob;
  videoBlob?: Blob;
}

interface MediaCaptureProps {
  onEmergencyTriggered: () => void;
  onOpenRecordings?: () => void;
}

export default function MediaCapture({ onEmergencyTriggered, onOpenRecordings }: MediaCaptureProps) {
  const [captureMode, setCaptureMode] = useState<CaptureMode>('idle');
  const [recordType, setRecordType] = useState<RecordType>('video');
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'saving' | 'uploading' | 'sent' | 'failed'>('idle');
  const [audioTranscript, setAudioTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [savedFileName, setSavedFileName] = useState<string>('');
  const [browserSupported, setBrowserSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setBrowserSupported(false);
      setError('Your browser does not support camera/microphone access. Please use Chrome, Edge, Firefox, or Safari.');
    }
    
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Start voice detection after a short delay to ensure component is ready
    const timer = setTimeout(() => {
      startVoiceDetection();
    }, 1000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(timer);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update video preview when stream or mode changes
  useEffect(() => {
    if (videoPreviewRef.current && streamRef.current && captureMode === 'recording_video') {
      videoPreviewRef.current.srcObject = streamRef.current;
      videoPreviewRef.current.play().catch(e => console.log('Play error:', e));
    }
  }, [captureMode, streamRef.current]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startLocationTracking = useCallback(async () => {
    try {
      await locationTracker.startTracking(
        (loc) => setLocation(loc),
        (err) => console.error('Location error:', err)
      );
    } catch (error) {
      console.error('Failed to start location tracking:', error);
    }
  }, []);

  const startVoiceDetection = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      alert('Voice detection not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    
    setIsListening(true);
    console.log('Starting voice detection...');
    
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      console.log('onresult fired', event);
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        console.log('Result:', result[0].transcript, 'isFinal:', result.isFinal);
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }
      if (finalTranscript) {
        console.log('Heard:', finalTranscript);
        setAudioTranscript(finalTranscript);
        const normalized = finalTranscript.toLowerCase().trim();
        console.log('Normalized:', normalized);
        if (normalized.includes('help me zelda') || normalized.includes('help me') || normalized.includes('zelda')) {
          console.log('Trigger detected! Starting SOS...');
          recognition.stop();
          setTimeout(() => startRecording('sos'), 100);
        }
      }
    };

    recognition.onend = () => {
      console.log('Voice recognition ended, isListening:', isListening);
      if (isListening) {
        try { 
          recognition.start(); 
          console.log('Voice recognition restarted');
        } catch (e: any) { 
          console.log('Could not restart:', e.message);
          setIsListening(false); 
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech error:', event.error);
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone permission.');
        setIsListening(false);
      } else if (event.error === 'no-speech') {
        console.log('No speech detected, continuing...');
      } else if (event.error !== 'aborted') {
        console.log('Speech error:', event.error);
      }
    };

    try { 
      recognition.start(); 
      recognitionRef.current = recognition;
      console.log('Voice recognition started successfully');
    }
    catch (err: any) { 
      console.error('Failed to start:', err); 
      setIsListening(false); 
      alert('Could not start voice detection. Please allow microphone access.');
    }
  }, [isListening]);

  const startRecording = useCallback(async (type: RecordType = 'video') => {
    setError(null);
    setRecordType(type);
    setCaptureMode(type === 'audio' ? 'recording_audio' : 'recording_video');
    setRecordingTime(0);

    // Start location tracking
    try {
      await locationTracker.startTracking(
        (loc) => setLocation(loc),
        (err) => console.error('Location error:', err)
      );
    } catch (error) {
      console.error('Failed to start location tracking:', error);
    }

    try {
      console.log('Starting recording, type:', type);
      
      let stream: MediaStream;
      let hasVideo = false;
      
      if (type === 'audio') {
        // Audio only - request microphone
        console.log('Requesting microphone...');
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true,
          video: false 
        });
        hasVideo = false;
      } else {
        // Video mode - request both together
        console.log('Requesting camera and microphone...');
        
        // Try with standard constraints first
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true,
            video: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
          hasVideo = stream.getVideoTracks().length > 0;
          console.log('Got stream with video:', hasVideo);
        } catch (err: any) {
          console.log('Standard failed, trying user facing camera:', err);
          // Try front camera
          try {
            stream = await navigator.mediaDevices.getUserMedia({ 
              audio: true,
              video: {
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }
            });
            hasVideo = stream.getVideoTracks().length > 0;
          } catch (err2: any) {
            console.log('User camera failed, trying any camera:', err2);
            // Try any available camera
            try {
              stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true,
                video: true
              });
              hasVideo = stream.getVideoTracks().length > 0;
            } catch (err3: any) {
              console.log('Any camera failed, trying audio only:', err3);
              // Fall back to audio only
              stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true,
                video: false
              });
              hasVideo = false;
            }
          }
        }
      }
      
      console.log('Stream tracks:', stream.getTracks().map(t => `${t.kind}:${t.label}`));
      streamRef.current = stream;
      
      // Set up video preview - force update
      if (type !== 'audio') {
        setTimeout(() => {
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = stream;
            videoPreviewRef.current.play().catch(e => console.log('Play error:', e));
          }
        }, 100);
      }
      
      const duration = type === 'audio' ? 60000 : 30000;

      // Determine best mime type
      let mimeType = '';
      const types = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus', 
        'video/webm',
        'video/mp4',
        'video/webkit',
        'video/quic'
      ];
      
      for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
        }
      }
      console.log('Using MIME type:', mimeType);

      const mediaRecorder = mimeType 
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('Recording stopped, chunks:', audioChunksRef.current.length);
        clearTimer();
        stopStream();
        
        if (audioChunksRef.current.length === 0) {
          setError('No recording data captured. Please try again.');
          setCaptureMode('idle');
          return;
        }
        
        await processRecording(type, hasVideo);
      };

      mediaRecorderRef.current = mediaRecorder;
      
      // Start recording
      try {
        mediaRecorder.start(1000);
        console.log('MediaRecorder started, state:', mediaRecorder.state);
      } catch (startErr: any) {
        console.error('Failed to start MediaRecorder:', startErr);
        setError('Failed to start recording: ' + startErr.message);
        setCaptureMode('idle');
        return;
      }

      // Timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= (duration / 1000) - 1) { 
            stopRecording(); 
            return duration / 1000; 
          }
          return prev + 1;
        });
      }, 1000);

      // Auto-stop after duration
      setTimeout(() => { 
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording(); 
        }
      }, duration);

    } catch (err: any) {
      console.error('Recording error details:', err);
      let errorMessage = 'Failed to start recording.';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Permission denied.\n\n1. Click the 📷/🔒 icon in browser address bar\n2. Select "Allow" for Camera and Microphone\n3. Refresh page and try again';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No camera or microphone found.\n\nPlease connect a camera/mic and refresh.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Camera/mic in use by another app.\n\nClose other apps and try again.';
      } else {
        errorMessage = `Error: ${err.message || err.name || 'Unknown error'}`;
      }
      
      setError(errorMessage);
      setCaptureMode('idle');
    }
  }, [clearTimer, stopStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    setIsListening(false);
    setCaptureMode('processing');
  }, []);

  const processRecording = useCallback(async (type: RecordType, hasVideo: boolean = true) => {
    try {
      const timestamp = Date.now();
      const blob = new Blob(audioChunksRef.current, { type: 'video/webm' });
      const dataUrl = await blobToDataUrl(blob);

      if (type === 'audio' || !hasVideo) {
        // Audio-only recording
        const audioOnlyBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await saveBlobDirectly(audioOnlyBlob, 'audio', timestamp);
        setSavedFileName(`guardian_audio_${timestamp}.webm`);
        setCapturedMedia({ audioDataUrl: dataUrl, videoDataUrl: '', audioBlob: audioOnlyBlob });
      } else {
        // Video recording (with audio)
        await saveBlobDirectly(blob, 'video', timestamp);
        setSavedFileName(`guardian_video_${timestamp}.webm`);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioDataUrl = await blobToDataUrl(audioBlob);
        setCapturedMedia({ audioDataUrl, videoDataUrl: dataUrl, videoBlob: blob, audioBlob });
      }
      setCaptureMode('complete');
    } catch (err) {
      console.error('Processing error:', err);
      setError('Failed to process recording');
      setCaptureMode('idle');
    }
  }, []);

  const triggerEmergency = useCallback(async () => {
    if (!capturedMedia) return;
    setIsUploading(true);
    setUploadStatus('saving');
    setError(null);
    const currentLocation = locationTracker.getLastLocation();
    const timestamp = Date.now();

    try {
      const deviceInfo = navigator.userAgent;
      let emergencyId: string | null = null;
      
      if (capturedMedia.videoDataUrl) {
        saveRecordingToDevice({ 
          id: `video_${timestamp}`, 
          type: 'video', 
          dataUrl: capturedMedia.videoDataUrl, 
          timestamp, 
          emergencyId: emergencyId || undefined,
          location: currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : undefined 
        });
      }
      if (capturedMedia.audioDataUrl) {
        saveRecordingToDevice({ 
          id: `audio_${timestamp}`, 
          type: 'audio', 
          dataUrl: capturedMedia.audioDataUrl, 
          timestamp, 
          emergencyId: emergencyId || undefined,
          location: currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : undefined 
        });
      }

      console.log('Recording saved to My Recordings');

      if (isOnline) {
        setUploadStatus('uploading');
        try {
          const googleMapsUrl = `https://www.google.com/maps?q=${currentLocation?.latitude || 0},${currentLocation?.longitude || 0}`;
          const emergencyId = await createEmergency({ 
            latitude: currentLocation?.latitude || 0, 
            longitude: currentLocation?.longitude || 0, 
            audioUrl: capturedMedia.audioDataUrl, 
            videoUrl: capturedMedia.videoDataUrl, 
            deviceInfo, 
            googleMapsUrl,
            locationAccuracy: currentLocation?.accuracy
          });
          try {
            const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emergencyId, transcript: audioTranscript || 'Emergency audio captured' }) });
            if (response.ok) { const data = await response.json(); if (data.priority && data.reason) await updateEmergencyPriority(emergencyId, data.priority, data.reason); }
          } catch (aiError) { console.error('AI analysis failed:', aiError); await updateEmergencyPriority(emergencyId, 'MEDIUM', 'AI analysis unavailable'); }
          setUploadStatus('sent');
        } catch (firestoreError) { console.error('Firestore upload failed:', firestoreError); setUploadStatus('failed'); setError('Upload failed. Recording saved on device.'); }
      } else {
        setUploadStatus('failed');
        await offlineStorage.init();
        const emergencyUpload: PendingUpload = { id: `emergency_${timestamp}`, type: 'video', data: JSON.stringify({ audioUrl: capturedMedia.audioDataUrl, videoUrl: capturedMedia.videoDataUrl, deviceInfo, location: currentLocation, transcript: audioTranscript }), timestamp: Date.now(), status: 'pending', retryCount: 0, location: currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude, accuracy: currentLocation.accuracy, timestamp: currentLocation.timestamp } : undefined };
        await offlineStorage.addUpload(emergencyUpload);
      }
      onEmergencyTriggered();
      resetCapture();
    } catch (err) { console.error('Upload error:', err); setUploadStatus('failed'); setError('Failed to upload. Recording saved on device.'); onEmergencyTriggered(); }
    finally { setIsUploading(false); }
  }, [capturedMedia, audioTranscript, isOnline, onEmergencyTriggered]);

  const resetCapture = useCallback(() => {
    setCaptureMode('idle');
    setCapturedMedia(null);
    setLocation(null);
    setAudioTranscript('');
    setRecordingTime(0);
    setSavedFileName('');
    clearTimer();
    stopStream();
    locationTracker.stopTracking();
  }, [clearTimer, stopStream]);

  useEffect(() => {
    return () => { clearTimer(); stopStream(); if (recognitionRef.current) recognitionRef.current.stop(); if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop(); locationTracker.stopTracking(); };
  }, [clearTimer, stopStream]);

  const getRecordingTitle = () => recordType === 'audio' ? 'Recording Audio...' : recordType === 'sos' ? 'Recording SOS...' : 'Recording Video...';
  const getMaxTime = () => recordType === 'audio' ? 60 : 30;

  return (
    <div className="flex flex-col items-center p-8">
      {!browserSupported && (
        <div className="bg-red-500/20 border border-red-500 p-4 rounded-xl mb-4 max-w-md text-center">
          <p className="text-red-300 font-semibold">Browser Not Supported</p>
          <p className="text-red-200 text-sm mt-2">Your browser doesn't support camera/microphone. Please use:</p>
          <ul className="text-red-200 text-sm mt-2 text-left list-disc list-inside">
            <li>Google Chrome (recommended)</li>
            <li>Microsoft Edge</li>
            <li>Mozilla Firefox</li>
            <li>Safari (on Mac/iOS)</li>
          </ul>
        </div>
      )}
      <AnimatePresence mode="wait">
        {captureMode === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col items-center gap-6">
            <div className="flex flex-col gap-4 items-center">
              <motion.button 
                whileHover={browserSupported ? { scale: 1.05 } : {}} 
                whileTap={browserSupported ? { scale: 0.95 } : {}} 
                onClick={() => startRecording('sos')} 
                disabled={!browserSupported}
                className={`w-40 h-40 rounded-full shadow-2xl flex flex-col items-center justify-center ${browserSupported ? 'bg-gradient-to-br from-red-500 to-red-700' : 'bg-gray-600 cursor-not-allowed'}`}
              >
                <span className="text-5xl mb-2">🛡️</span>
                <span className="text-white font-semibold">SOS</span>
              </motion.button>
              <div className="flex gap-4">
                <motion.button 
                  whileHover={browserSupported ? { scale: 1.05 } : {}} 
                  whileTap={browserSupported ? { scale: 0.95 } : {}} 
                  onClick={() => startRecording('video')} 
                  disabled={!browserSupported}
                  className={`w-28 h-28 rounded-full shadow-2xl flex flex-col items-center justify-center ${browserSupported ? 'bg-gradient-to-br from-purple-500 to-purple-700' : 'bg-gray-600 cursor-not-allowed'}`}
                >
                  <span className="text-3xl mb-1">🎥</span>
                  <span className="text-white font-semibold text-sm">Video</span>
                  <span className="text-purple-200 text-xs">30s</span>
                </motion.button>
                <motion.button 
                  whileHover={browserSupported ? { scale: 1.05 } : {}} 
                  whileTap={browserSupported ? { scale: 0.95 } : {}} 
                  onClick={() => startRecording('audio')} 
                  disabled={!browserSupported}
                  className={`w-28 h-28 rounded-full shadow-2xl flex flex-col items-center justify-center ${browserSupported ? 'bg-gradient-to-br from-blue-500 to-blue-700' : 'bg-gray-600 cursor-not-allowed'}`}
                >
                  <span className="text-3xl mb-1">🎤</span>
                  <span className="text-white font-semibold text-sm">Audio</span>
                  <span className="text-blue-200 text-xs">60s</span>
                </motion.button>
              </div>
            </div>
            <p className="text-gray-300 text-center">Tap a button or say <strong>"help me zelda"</strong> to trigger emergency</p>
            
            {browserSupported && (
              <div className="bg-yellow-500/20 border border-yellow-500/30 px-4 py-3 rounded-lg text-yellow-300 text-sm text-center max-w-md">
                <p className="font-semibold">⚠️ Permission Required</p>
                <p className="mt-1">Click a button → If browser asks, click <strong>ALLOW</strong></p>
                <p className="mt-2 text-xs text-yellow-200">If denied, click the 🔒 icon in address bar → Allow</p>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <motion.div animate={isListening ? { scale: [1, 1.2, 1] } : {}} transition={{ repeat: Infinity, duration: 1.5 }} className={`w-3 h-3 rounded-full ${isListening ? 'bg-green-500' : 'bg-gray-500'}`} />
              <span className="text-gray-400 text-sm">{isListening ? 'Listening for "help me zelda"...' : 'Voice detection inactive'}</span>
              {!isListening ? (
                <button 
                  onClick={() => startVoiceDetection()}
                  className="ml-2 px-3 py-1 bg-blue-500 text-white text-xs rounded-full hover:bg-blue-600"
                >
                  🎤 Enable Voice
                </button>
              ) : (
                <button 
                  onClick={() => {
                    recognitionRef.current?.stop();
                    setIsListening(false);
                  }}
                  className="ml-2 px-3 py-1 bg-red-500 text-white text-xs rounded-full hover:bg-red-600"
                >
                  ⏹ Stop
                </button>
              )}
            </div>
            {audioTranscript && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/10 px-4 py-2 rounded-lg text-white text-sm mt-2">"I heard: {audioTranscript}"</motion.div>}
            
            {/* TEST BUTTON - Remove after testing */}
            <button 
              onClick={() => startRecording('sos')}
              className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-full text-sm hover:bg-orange-600"
            >
              🧪 TEST: Trigger SOS (for testing)
            </button>
          </motion.div>
        )}

        {(captureMode === 'recording_video' || captureMode === 'recording_audio') && (
          <motion.div key="recording" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-32 h-32 rounded-full bg-red-500 shadow-2xl flex items-center justify-center">
              <span className="text-6xl">🔴</span>
            </motion.div>
            <p className="text-white text-xl font-semibold">{getRecordingTitle()}</p>
            <p className="text-gray-400">{recordingTime}s / {getMaxTime()}s</p>
            {location && <div className="bg-white/10 px-4 py-2 rounded-lg flex items-center gap-2"><span className="text-green-400">📍</span><span className="text-white text-sm">{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span></div>}
            <button onClick={stopRecording} className="mt-4 px-8 py-3 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition-colors">Stop Recording</button>
          </motion.div>
        )}

        {captureMode === 'processing' && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full bg-yellow-500 shadow-2xl flex items-center justify-center"><span className="text-6xl">⏳</span></div>
            <p className="text-white text-xl">Saving to device...</p>
            <p className="text-gray-400 text-sm">Please wait</p>
          </motion.div>
        )}

        {captureMode === 'complete' && capturedMedia && (
          <motion.div key="complete" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full bg-green-500 shadow-2xl flex items-center justify-center"><span className="text-6xl">✓</span></div>
            <p className="text-white text-xl font-semibold">Saved Successfully!</p>
            
            {/* Saved Locations Info */}
            <div className="bg-green-500/20 border border-green-500/30 px-4 py-2 rounded-lg text-green-300 text-sm text-center">
              <p>✅ Saved to Device (Download)</p>
              <p>✅ Saved in My Recordings</p>
              {isOnline && <p>✅ Sent to Police Dashboard</p>}
            </div>
            
            {/* TEST: Location Link Button */}
            <a 
              href={`https://www.google.com/maps?q=${location?.latitude || 10.727482},${location?.longitude || 78.558403}`}
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-semibold flex items-center gap-2"
            >
              📍 View Location on Google Maps
            </a>
            
            <div className="bg-white/10 rounded-xl p-4 max-w-md">
              <p className="text-gray-300 text-sm mb-2">Captured:</p>
              <ul className="text-white space-y-1">
                {recordType !== 'audio' && <li>✅ Video evidence (30 seconds)</li>}
                {recordType !== 'video' && <li>✅ Audio recording (60 seconds)</li>}
                {location && (
                  <li>
                    ✅ Location: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </li>
                )}
              </ul>
            </div>
            {uploadStatus !== 'idle' && <div className={`px-4 py-2 rounded-lg text-sm ${uploadStatus === 'sent' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>{uploadStatus === 'sent' ? '✅ Sent to police dashboard' : '⚠️ Saved locally only'}</div>}
            <div className="flex gap-4">
              <button onClick={resetCapture} disabled={isUploading} className="px-6 py-3 bg-gray-600 text-white rounded-full hover:bg-gray-700 disabled:opacity-50">Record More</button>
              {onOpenRecordings && (
                <button onClick={onOpenRecordings} className="px-6 py-3 bg-purple-600 text-white rounded-full hover:bg-purple-700">
                  📁 My Recordings
                </button>
              )}
              <button onClick={triggerEmergency} disabled={isUploading} className="px-8 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 disabled:opacity-50">{isUploading ? 'Processing...' : 'SEND EMERGENCY'}</button>
            </div>
            {isOnline ? <div className="bg-green-500/20 border border-green-500/30 px-4 py-2 rounded-lg text-green-300 text-sm">📶 Online - Will send to police dashboard</div> : <div className="bg-yellow-500/20 border border-yellow-500/30 px-4 py-2 rounded-lg text-yellow-300 text-sm">📴 Offline Mode - Data will sync when internet is available</div>}
          </motion.div>
        )}
      </AnimatePresence>
      {error && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-xl max-w-md text-center">{error}</motion.div>}
    </div>
  );
}
