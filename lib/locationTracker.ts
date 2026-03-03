import { offlineStorage, PendingUpload } from './offlineStorage';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

export interface LocationTrackerOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
  watchInterval?: number;
}

export type LocationCallback = (location: LocationData) => void;
export type ErrorCallback = (error: GeolocationPositionError) => void;

class LocationTracker {
  private watchId: number | null = null;
  private isTracking: boolean = false;
  private lastLocation: LocationData | null = null;
  private onLocationChange: LocationCallback | null = null;
  private onError: ErrorCallback | null = null;
  private options: LocationTrackerOptions = {
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 30000,
    watchInterval: 5000,
  };

  constructor(options?: LocationTrackerOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
  }

  async startTracking(
    onLocationUpdate: LocationCallback,
    onError?: ErrorCallback
  ): Promise<boolean> {
    if (this.isTracking) {
      console.warn('Location tracking already started');
      return true;
    }

    this.onLocationChange = onLocationUpdate;
    this.onError = onError || null;

    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      onError?.(new GeolocationPositionError());
      return false;
    }

    try {
      const initialPosition = await this.getCurrentLocation();
      if (initialPosition) {
        this.lastLocation = initialPosition;
        onLocationUpdate(initialPosition);
      }
    } catch (error) {
      console.error('Failed to get initial location:', error);
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const locationData: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          speed: position.coords.speed,
          heading: position.coords.heading,
          timestamp: position.timestamp,
        };

        this.lastLocation = locationData;
        onLocationUpdate(locationData);

        this.saveLocationToOffline(locationData);
      },
      (error) => {
        console.error('Geolocation error:', error);
        onError?.(error);
      },
      {
        enableHighAccuracy: this.options.enableHighAccuracy,
        maximumAge: this.options.maximumAge,
        timeout: this.options.timeout,
      }
    );

    this.isTracking = true;
    console.log('Location tracking started');
    return true;
  }

  stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    console.log('Location tracking stopped');
  }

  async getCurrentLocation(): Promise<LocationData | null> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            speed: position.coords.speed,
            heading: position.coords.heading,
            timestamp: position.timestamp,
          };
          resolve(locationData);
        },
        (error) => {
          console.error('Get current location error:', error);
          reject(error);
        },
        {
          enableHighAccuracy: this.options.enableHighAccuracy,
          maximumAge: this.options.maximumAge,
          timeout: this.options.timeout,
        }
      );
    });
  }

  getLastLocation(): LocationData | null {
    return this.lastLocation;
  }

  private async saveLocationToOffline(location: LocationData): Promise<void> {
    try {
      await offlineStorage.init();
      
      const locationUpload: PendingUpload = {
        id: `location_${Date.now()}`,
        type: 'location',
        data: '',
        timestamp: Date.now(),
        status: 'pending',
        retryCount: 0,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: location.timestamp,
        },
      };

      await offlineStorage.addUpload(locationUpload);
    } catch (error) {
      console.error('Failed to save location to offline storage:', error);
    }
  }

  async getStoredLocations(): Promise<LocationData[]> {
    try {
      await offlineStorage.init();
      const uploads = await offlineStorage.getAllPending();
      return uploads
        .filter(u => u.type === 'location' && u.location)
        .map(u => u.location as LocationData);
    } catch (error) {
      console.error('Failed to get stored locations:', error);
      return [];
    }
  }

  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }
}

export const locationTracker = new LocationTracker();
export default locationTracker;
