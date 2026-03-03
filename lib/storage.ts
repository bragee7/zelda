import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Convert blob to base64 (for offline storage fallback)
export async function audioToBase64(audioBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });
}

// Upload audio to Firebase Storage and return download URL
export async function uploadAudio(
  audioBlob: Blob,
  emergencyId: string
): Promise<string> {
  try {
    // Create unique filename
    const filename = `emergencies/${emergencyId}/audio_${Date.now()}.webm`;
    const storageRef = ref(storage, filename);
    
    // Upload the file
    await uploadBytes(storageRef, audioBlob, {
      contentType: 'audio/webm',
    });
    
    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    console.log('Audio uploaded to Firebase Storage:', downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading audio to Firebase Storage:', error);
    // Fallback to base64 if Firebase Storage fails
    console.log('Falling back to base64...');
    const base64Audio = await audioToBase64(audioBlob);
    return base64Audio;
  }
}

// Upload video to Firebase Storage and return download URL
export async function uploadVideo(
  videoBlob: Blob,
  emergencyId: string
): Promise<string> {
  try {
    // Create unique filename
    const filename = `emergencies/${emergencyId}/video_${Date.now()}.webm`;
    const storageRef = ref(storage, filename);
    
    // Upload the file
    await uploadBytes(storageRef, videoBlob, {
      contentType: 'video/webm',
    });
    
    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);
    console.log('Video uploaded to Firebase Storage:', downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading video to Firebase Storage:', error);
    // Fallback to base64 if Firebase Storage fails
    console.log('Falling back to base64...');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(videoBlob);
    });
  }
}
