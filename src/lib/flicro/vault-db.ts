// IndexedDB Persistent Storage for Private Space and Device Media

export interface VaultRecord {
  id: string;
  name: string;
  size: number;
  type: string;
  blob: Blob;
  addedAt: number;
}

const DB_NAME = "flicro_vault_db";
const DB_VERSION = 1;
const VAULT_STORE = "vault_items";
const CONTACTS_STORE = "contacts_store";
const MUSIC_STORE = "music_store";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported on this device"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(VAULT_STORE)) {
        db.createObjectStore(VAULT_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(CONTACTS_STORE)) {
        db.createObjectStore(CONTACTS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(MUSIC_STORE)) {
        db.createObjectStore(MUSIC_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Request permanent persistence on device
export async function enablePersistentStorage(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        return await navigator.storage.persist();
      }
      return isPersisted;
    } catch {
      return false;
    }
  }
  return false;
}

// Save Vault Item
export async function saveVaultItem(record: VaultRecord): Promise<void> {
  await enablePersistentStorage();
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, "readwrite");
    const store = tx.objectStore(VAULT_STORE);
    const req = store.put(record);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Get All Vault Items
export async function getVaultItems(): Promise<VaultRecord[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(VAULT_STORE, "readonly");
      const store = tx.objectStore(VAULT_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = req.result as VaultRecord[];
        // Sort newest first
        records.sort((a, b) => b.addedAt - a.addedAt);
        resolve(records);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

// Delete Vault Item
export async function deleteVaultItem(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VAULT_STORE, "readwrite");
    const store = tx.objectStore(VAULT_STORE);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Get Total Vault Stored Size in Bytes
export async function getVaultTotalSize(): Promise<number> {
  try {
    const items = await getVaultItems();
    return items.reduce((acc, item) => acc + (item.size || 0), 0);
  } catch {
    return 0;
  }
}
