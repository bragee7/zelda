const DB_NAME = 'GuardianVoiceOffline';
const DB_VERSION = 1;
const STORE_NAME = 'pending_uploads';
const MAX_STORAGE_SIZE = 50 * 1024 * 1024;

export interface PendingUpload {
  id: string;
  type: 'audio' | 'video' | 'location';
  data: string;
  timestamp: number;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  retryCount: number;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  };
}

class OfflineStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  private async getStore(mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(STORE_NAME, mode);
    return transaction.objectStore(STORE_NAME);
  }

  async addUpload(upload: PendingUpload): Promise<void> {
    const store = await this.getStore('readwrite');
    
    const request = store.add(upload);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        console.log('Upload added to offline storage:', upload.id);
        this.enforceStorageLimit();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateUpload(id: string, updates: Partial<PendingUpload>): Promise<void> {
    const store = await this.getStore('readwrite');
    
    const getRequest = store.get(id);
    
    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const existing = getRequest.result as PendingUpload;
        if (!existing) {
          resolve();
          return;
        }
        
        const updated = { ...existing, ...updates };
        const putRequest = store.put(updated);
        
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async getPendingUploads(): Promise<PendingUpload[]> {
    const store = await this.getStore('readonly');
    const index = store.index('status');
    const request = index.getAll('pending');
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPending(): Promise<PendingUpload[]> {
    const store = await this.getStore('readonly');
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const results = request.result as PendingUpload[];
        resolve(results.filter(r => r.status !== 'uploaded'));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteUpload(id: string): Promise<void> {
    const store = await this.getStore('readwrite');
    const request = store.delete(id);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getStorageUsed(): Promise<number> {
    const uploads = await this.getAllPending();
    let totalSize = 0;
    
    for (const upload of uploads) {
      if (upload.data) {
        totalSize += upload.data.length * 0.75;
      }
    }
    
    return totalSize;
  }

  private async enforceStorageLimit(): Promise<void> {
    const uploads = await this.getAllPending();
    let totalSize = 0;
    
    for (const upload of uploads) {
      if (upload.data) {
        totalSize += upload.data.length * 0.75;
      }
    }
    
    while (totalSize > MAX_STORAGE_SIZE && uploads.length > 0) {
      const oldest = uploads.shift();
      if (oldest) {
        await this.deleteUpload(oldest.id);
        totalSize -= oldest.data ? oldest.data.length * 0.75 : 0;
      }
    }
  }

  async getPendingCount(): Promise<number> {
    const uploads = await this.getAllPending();
    return uploads.length;
  }

  async clearAll(): Promise<void> {
    const store = await this.getStore('readwrite');
    const request = store.clear();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const offlineStorage = new OfflineStorage();
export default offlineStorage;
