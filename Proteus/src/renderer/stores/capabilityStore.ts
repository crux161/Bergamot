import {
  createDefaultCapabilityFlags,
  mergeCapabilityFlags,
  type BergamotCapabilityFlags,
} from "@bergamot/contracts";
import { createStore, type ReadableStore } from "./createStore";

export type CapabilityFlags = BergamotCapabilityFlags;

const defaultFlags: CapabilityFlags = createDefaultCapabilityFlags();

const internalStore = createStore<{ flags: CapabilityFlags }>({
  flags: defaultFlags,
});

export const capabilityStore: ReadableStore<{ flags: CapabilityFlags }> & {
  getFlagEntries: () => Array<{ key: keyof CapabilityFlags; enabled: boolean }>;
  applyServerFlags: (next?: Partial<CapabilityFlags> | null) => void;
  reset: () => void;
} = {
  getSnapshot: internalStore.getSnapshot,
  subscribe: internalStore.subscribe,
  getFlagEntries: () =>
    Object.entries(internalStore.getSnapshot().flags).map(([key, enabled]) => ({
      key: key as keyof CapabilityFlags,
      enabled,
    })),
  applyServerFlags: (next) =>
    internalStore.setState((prev) => ({
      ...prev,
      flags: mergeCapabilityFlags(next),
    })),
  reset: () =>
    internalStore.setState((prev) => ({
      ...prev,
      flags: createDefaultCapabilityFlags(),
    })),
};
