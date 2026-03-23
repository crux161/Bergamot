// Provide a minimal localStorage stub for tests running in a Node environment
if (typeof globalThis.localStorage === "undefined") {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem(key: string) { return store[key] ?? null; },
    setItem(key: string, value: string) { store[key] = value; },
    removeItem(key: string) { delete store[key]; },
    clear() { for (const k of Object.keys(store)) delete store[k]; },
  };
}
