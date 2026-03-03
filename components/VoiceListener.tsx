'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createEmergency, updateEmergencyPriority } from '@/lib/firestore';
import { uploadAudio } from '@/lib/storage';

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: 'aborted' | 'audio-capture' | 'bad-grammar' | 'language-not-supported' | 'network' | 'no-speech' | 'not-allowed' | 'service-not-allowed';
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface VoiceListenerProps {
  onEmergencyTriggered: () => void;
}

type ListeningState = 'inactive' | 'listening' | 'recording' | 'processing';

export default function VoiceListener({ onEmergencyTriggered }: VoiceListenerProps) {
  const [listeningState, setListeningState] = useState<ListeningState>('inactive');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [speechUnsupported, setSpeechUnsupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const getLocation = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  }, []);

  const getDeviceInfo = useCallback(() => {
    return navigator.userAgent;
  }, []);

  const processEmergency = useCallback(async (finalTranscript: string) => {
    if (listeningState !== 'listening') return;
    
    setListeningState('processing');
    setTranscript(finalTranscript);

    try {
      const position = await getLocation();
      const deviceInfo = getDeviceInfo();

      const tempId = `emergency_${Date.now()}`;
      
      setListeningState('recording');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();

      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 10000);

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        try {
          const audioUrl = await uploadAudio(audioBlob, tempId);
          
          const emergencyId = await createEmergency({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            audioUrl,
            deviceInfo,
          });

          try {
            const response = await fetch('/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                emergencyId,
                transcript: finalTranscript 
              }),
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.priority && data.reason) {
                await updateEmergencyPriority(
                  emergencyId,
                  data.priority,
                  data.reason
                );
              }
            }
          } catch (aiError) {
            console.error('AI analysis failed:', aiError);
            await updateEmergencyPriority(
              emergencyId,
              'MEDIUM',
              'AI analysis unavailable, defaulting to MEDIUM'
            );
          }

          onEmergencyTriggered();
          setListeningState('inactive');
          setTimeout(() => setListeningState('listening'), 3000);
        } catch (uploadError) {
          console.error('Upload failed:', uploadError);
          setError('Failed to upload audio. Please try again.');
          setListeningState('listening');
        }
      };
    } catch (locationError) {
      console.error('Location error:', locationError);
      setError('Could not get location. Please enable location services.');
      setListeningState('listening');
    }
  }, [listeningState, getLocation, getDeviceInfo, onEmergencyTriggered]);

  const startListening = useCallback(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      setSpeechUnsupported(true);
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    setError(null);
    setTranscript('');

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(finalTranscript);
        
        const normalized = finalTranscript.toLowerCase().trim();
        if (normalized.includes('help me now')) {
          recognition.stop();
          processEmergency(finalTranscript);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      
      if (event.error === 'not-allowed') {
        setPermissionDenied(true);
        setError('Microphone permission denied. Please allow microphone access.');
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setError(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (listeningState === 'listening') {
        try {
          recognition.start();
        } catch {
          setListeningState('inactive');
        }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListeningState('listening');
    } catch (startError) {
      console.error('Failed to start recognition:', startError);
      setError('Failed to start voice recognition.');
    }
  }, [listeningState, processEmergency]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setListeningState('inactive');
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const getStatusColor = () => {
    switch (listeningState) {
      case 'listening':
        return 'bg-green-500';
      case 'recording':
        return 'bg-red-500';
      case 'processing':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    switch (listeningState) {
      case 'listening':
        return 'Listening for "help me now"...';
      case 'recording':
        return 'Recording emergency audio...';
      case 'processing':
        return 'Processing emergency...';
      default:
        return 'Tap to start voice protection';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <AnimatePresence mode="wait">
        {listeningState === 'inactive' && (
          <motion.button
            key="start-btn"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={startListening}
            className="w-48 h-48 rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-2xl flex items-center justify-center hover:scale-105 transition-transform"
          >
            <div className="text-white text-center">
              <div className="text-4xl mb-2">🛡️</div>
              <div className="text-sm font-medium">Start Protection</div>
            </div>
          </motion.button>
        )}

        {listeningState !== 'inactive' && (
          <motion.div
            key="listening-indicator"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="flex flex-col items-center"
          >
            <motion.div
              animate={
                listeningState === 'recording'
                  ? { scale: [1, 1.2, 1] }
                  : listeningState === 'listening'
                  ? { scale: [1, 1.1, 1] }
                  : {}
              }
              transition={{ repeat: Infinity, duration: listeningState === 'recording' ? 0.5 : 2 }}
              className={`w-48 h-48 rounded-full ${getStatusColor()} shadow-2xl flex items-center justify-center`}
            >
              <div className="text-white text-center">
                <div className="text-4xl mb-2">
                  {listeningState === 'recording' ? '🔴' : '🎤'}
                </div>
                <div className="text-sm font-medium">{getStatusText()}</div>
              </div>
            </motion.div>

            {transcript && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 bg-white/10 rounded-xl text-white text-center max-w-md"
              >
                <p className="text-sm">Detected:</p>
                <p className="font-semibold">"{transcript}"</p>
              </motion.div>
            )}

            <button
              onClick={stopListening}
              className="mt-4 px-6 py-2 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition-colors"
            >
              Stop Listening
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
          {permissionDenied && (
            <p className="text-sm mt-2">
              Please enable microphone access in your browser settings.
            </p>
          )}
        </motion.div>
      )}

      {speechUnsupported && !error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-xl max-w-md text-center"
        >
          <p className="font-semibold">Voice Recognition Not Supported</p>
          <p className="text-sm mt-2">
            Please use Chrome, Edge, or Safari for voice activation.
          </p>
        </motion.div>
      )}

      <div className="mt-8 text-gray-500 text-sm text-center max-w-md">
        <p>Say <strong>"help me now"</strong> to trigger an emergency alert.</p>
        <p className="mt-2">Your location will be captured and 10 seconds of audio will be recorded.</p>
      </div>
    </div>
  );
}
