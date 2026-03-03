import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot,
  Timestamp,
  QueryConstraint 
} from 'firebase/firestore';

export interface Emergency {
  id: string;
  status: 'ACTIVE' | 'RESOLVED';
  createdAt: Date;
  latitude: number;
  longitude: number;
  audioUrl: string;
  videoUrl?: string;
  deviceInfo: string;
  aiPriority: 'LOW' | 'MEDIUM' | 'HIGH';
  aiReason: string;
  locationAccuracy?: number;
  isOffline?: boolean;
  googleMapsUrl?: string;
}

const emergenciesCollection = collection(db, 'emergencies');

export async function createEmergency(data: {
  latitude: number;
  longitude: number;
  audioUrl: string;
  videoUrl?: string;
  deviceInfo: string;
  locationAccuracy?: number;
  googleMapsUrl?: string;
}): Promise<string> {
  const docRef = await addDoc(emergenciesCollection, {
    status: 'ACTIVE',
    createdAt: Timestamp.now(),
    latitude: data.latitude,
    longitude: data.longitude,
    audioUrl: data.audioUrl,
    videoUrl: data.videoUrl || '',
    deviceInfo: data.deviceInfo,
    locationAccuracy: data.locationAccuracy || 0,
    aiPriority: 'MEDIUM',
    aiReason: 'Pending analysis...',
    googleMapsUrl: data.googleMapsUrl || '',
  });
  return docRef.id;
}

export async function updateEmergencyPriority(
  emergencyId: string,
  priority: 'LOW' | 'MEDIUM' | 'HIGH',
  reason: string
): Promise<void> {
  const emergencyRef = doc(db, 'emergencies', emergencyId);
  await updateDoc(emergencyRef, {
    aiPriority: priority,
    aiReason: reason,
  });
}

export async function resolveEmergency(emergencyId: string): Promise<void> {
  const emergencyRef = doc(db, 'emergencies', emergencyId);
  await updateDoc(emergencyRef, {
    status: 'RESOLVED',
  });
}

export function subscribeToActiveEmergencies(
  callback: (emergencies: Emergency[]) => void
): () => void {
  const constraints: QueryConstraint[] = [
    where('status', '==', 'ACTIVE'),
  ];
  const q = query(emergenciesCollection, ...constraints);

  return onSnapshot(q, (snapshot) => {
    const emergencies = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        status: data.status,
        createdAt: data.createdAt?.toDate() || new Date(),
        latitude: data.latitude,
        longitude: data.longitude,
        audioUrl: data.audioUrl,
        videoUrl: data.videoUrl,
        deviceInfo: data.deviceInfo,
        aiPriority: data.aiPriority || 'MEDIUM',
        aiReason: data.aiReason || '',
        locationAccuracy: data.locationAccuracy,
        googleMapsUrl: data.googleMapsUrl,
      } as Emergency;
    });
    callback(emergencies);
  });
}
