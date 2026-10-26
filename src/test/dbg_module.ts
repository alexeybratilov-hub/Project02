if (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== 'function') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as any;
}
import { storage } from '../services/storage';
console.log('A', storage.isModuleEnabled('sout'));
storage.toggleModule('sout');
console.log('B', storage.isModuleEnabled('sout'));
console.log(JSON.stringify(storage.getModules().map(m => [m.module_id, m.enabled])));
