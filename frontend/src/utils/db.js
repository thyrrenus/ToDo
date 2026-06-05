const DB_NAME = 'todo_offline_db';
const DB_VERSION = 1;
const STORES = ['tasks', 'lists', 'tags', 'sections', 'listGroups'];

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (e) => {
      console.error('IndexedDB open error:', e);
      reject(e.target.error);
    };

    request.onsuccess = (e) => {
      resolve(e.target.result);
    };

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      
      // Data stores for local caching
      STORES.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });

      // Queue store for pending offline write actions
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

export const db = {
  // Save or update a single item in a store
  async saveItem(storeName, item) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Save an entire array of items to a store, optionally clearing it first
  async saveCollection(storeName, items, clearFirst = true) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      if (clearFirst) {
        store.clear();
      }

      items.forEach(item => {
        store.put(item);
      });

      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  // Retrieve all items from a store
  async getCollection(storeName) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Delete a single item by key from a store
  async deleteItem(storeName, id) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Enqueue a sync action
  async enqueueAction(action) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      const request = store.add(action);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Get all enqueued sync actions
  async getQueue() {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('syncQueue', 'readonly');
      const store = tx.objectStore('syncQueue');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // Remove a sync action from the queue
  async dequeueAction(id) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('syncQueue', 'readwrite');
      const store = tx.objectStore('syncQueue');
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  }
};
