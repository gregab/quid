const store = new Map<string, string>();

const AsyncStorage = {
  getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
  setItem: (key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
  clear: () => {
    store.clear();
    return Promise.resolve();
  },
  getAllKeys: () => Promise.resolve([...store.keys()]),
  multiGet: (keys: string[]) =>
    Promise.resolve(keys.map((k) => [k, store.get(k) ?? null] as [string, string | null])),
  multiSet: (pairs: [string, string][]) => {
    pairs.forEach(([k, v]) => store.set(k, v));
    return Promise.resolve();
  },
  multiRemove: (keys: string[]) => {
    keys.forEach((k) => store.delete(k));
    return Promise.resolve();
  },
};

export default AsyncStorage;
