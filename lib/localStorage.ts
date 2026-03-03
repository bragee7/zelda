export interface SavedRecording {
  id: string;
  type: 'audio' | 'video';
  dataUrl: string;
  timestamp: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  emergencyId?: string;
}

const RECORDINGS_KEY = 'guardian_voice_recordings';

export function saveRecordingToDevice(recording: SavedRecording): void {
  const recordings = getRecordings();
  recordings.unshift(recording);
  
  if (recordings.length > 100) {
    recordings.pop();
  }
  
  localStorage.setItem(RECORDINGS_KEY, JSON.stringify(recordings));
}

export function getRecordings(): SavedRecording[] {
  if (typeof window === 'undefined') return [];
  
  const data = localStorage.getItem(RECORDINGS_KEY);
  if (!data) return [];
  
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function deleteRecording(id: string): void {
  const recordings = getRecordings();
  const filtered = recordings.filter(r => r.id !== id);
  localStorage.setItem(RECORDINGS_KEY, JSON.stringify(filtered));
}

export function clearAllRecordings(): void {
  localStorage.removeItem(RECORDINGS_KEY);
}

export async function downloadFile(dataUrl: string, filename: string): Promise<void> {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function saveToDeviceGallery(dataUrl: string, type: 'audio' | 'video'): Promise<boolean> {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    
    const filename = `guardian_voice_${type}_${Date.now()}.webm`;
    
    if (navigator.share) {
      const file = new File([blob], filename, { 
        type: type === 'video' ? 'video/webm' : 'audio/webm' 
      });
      
      await navigator.share({
        files: [file],
        title: `Guardian Voice ${type === 'video' ? 'Video' : 'Audio'} Recording`,
        text: `Emergency ${type} recording from Guardian Voice`
      });
      return true;
    } else {
      downloadFile(dataUrl, filename);
      return true;
    }
  } catch (error) {
    console.error('Failed to save to gallery:', error);
    downloadFile(dataUrl, `guardian_voice_${type}_${Date.now()}.webm`);
    return false;
  }
}

export function getStorageUsed(): number {
  const recordings = getRecordings();
  let totalSize = 0;
  
  for (const recording of recordings) {
    if (recording.dataUrl) {
      totalSize += recording.dataUrl.length * 0.75;
    }
  }
  
  return totalSize;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export async function saveBlobDirectly(blob: Blob, type: 'audio' | 'video', timestamp: number): Promise<string> {
  const extension = 'webm';
  const prefix = type === 'video' ? 'guardian_video' : 'guardian_audio';
  const filename = `${prefix}_${timestamp}.${extension}`;
  
  if (isMobile() && navigator.share) {
    const file = new File([blob], filename, { 
      type: type === 'video' ? 'video/webm' : 'audio/webm' 
    });
    
    try {
      await navigator.share({
        files: [file],
        title: `Guardian Voice ${type === 'video' ? 'Video' : 'Audio'}`,
        text: `Emergency ${type} recording`
      });
      console.log('Saved to device via share API');
      return filename;
    } catch (err) {
      console.log('Share cancelled, trying download');
    }
  }
  
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log(`Downloaded: ${filename}`);
      resolve(filename);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
