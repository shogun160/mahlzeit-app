// Bild-Cache fuer Remote-Rezepte.
// - In Capacitor (Android): schreibt/liest Dateien in Directory.Data/remote-dishes/
// - In Browser (npm run dev): nutzt IndexedDB mit Blob-URLs als Fallback.
//
// API:
//   await imageCache.has(id) -> boolean
//   await imageCache.get(id) -> string | null (Datei-URI oder Blob-URL, direkt in <img src> nutzbar)
//   await imageCache.put(id, blob) -> void
//   await imageCache.remove(id) -> void
//
// Wichtig: IndexedDB-Fallback ist nur fuer Dev-Testing gedacht.
// In der APK laeuft immer der Capacitor-Zweig.

import { Capacitor } from '@capacitor/core';

const DIR = 'remote-dishes';   // relativ zu Directory.Data
const IDB_NAME = 'mahlzeit-remote-images';
const IDB_STORE = 'images';

// --- Capacitor-Impl -----------------------------------------------------

async function capacitorImpl() {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');

  return {
    async has(id) {
      try {
        await Filesystem.stat({ path: `${DIR}/dish-${id}.jpg`, directory: Directory.Data });
        return true;
      } catch (_) {
        return false;
      }
    },
    async get(id) {
      try {
        const res = await Filesystem.getUri({ path: `${DIR}/dish-${id}.jpg`, directory: Directory.Data });
        // Capacitor liefert file:// - webview-tauglich via Capacitor.convertFileSrc.
        return Capacitor.convertFileSrc(res.uri);
      } catch (_) {
        return null;
      }
    },
    async put(id, blob) {
      const base64 = await blobToBase64(blob);
      await Filesystem.writeFile({
        path: `${DIR}/dish-${id}.jpg`,
        data: base64,
        directory: Directory.Data,
        recursive: true,
      });
    },
    async remove(id) {
      try {
        await Filesystem.deleteFile({ path: `${DIR}/dish-${id}.jpg`, directory: Directory.Data });
      } catch (_) { /* schon weg → ignorieren */ }
    },
  };
}

// --- IndexedDB-Impl (Dev-Fallback) --------------------------------------

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key, value) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// In-Memory-URL-Registry: URL.createObjectURL erzeugt neue String-Referenzen,
// die wir wiederverwenden statt jedes Mal neu erstellen.
const blobUrls = new Map();

function indexedDbImpl() {
  return {
    async has(id) {
      return !!(await idbGet(`dish-${id}`));
    },
    async get(id) {
      if (blobUrls.has(id)) return blobUrls.get(id);
      const blob = await idbGet(`dish-${id}`);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      blobUrls.set(id, url);
      return url;
    },
    async put(id, blob) {
      await idbPut(`dish-${id}`, blob);
      if (blobUrls.has(id)) {
        URL.revokeObjectURL(blobUrls.get(id));
        blobUrls.delete(id);
      }
    },
    async remove(id) {
      await idbDelete(`dish-${id}`);
      if (blobUrls.has(id)) {
        URL.revokeObjectURL(blobUrls.get(id));
        blobUrls.delete(id);
      }
    },
  };
}

// --- Helper -------------------------------------------------------------

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result);
      // "data:image/jpeg;base64,XYZ..." -> nur der XYZ-Teil
      const commaIdx = dataUrl.indexOf(',');
      resolve(dataUrl.slice(commaIdx + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// --- Public API ---------------------------------------------------------

let impl = null;

async function getImpl() {
  if (impl) return impl;
  impl = Capacitor.isNativePlatform() ? await capacitorImpl() : indexedDbImpl();
  return impl;
}

export const imageCache = {
  async has(id) { return (await getImpl()).has(id); },
  async get(id) { return (await getImpl()).get(id); },
  async put(id, blob) { return (await getImpl()).put(id, blob); },
  async remove(id) { return (await getImpl()).remove(id); },
};
