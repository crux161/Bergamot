import manifest from "../data/instance-manifest.json";

export interface BergamotCapabilityFlags {
  routeShell: boolean;
  favorites: boolean;
  quickSwitcher: boolean;
  customThemes: boolean;
  localNotifications: boolean;
  replies: boolean;
  reactions: boolean;
  pins: boolean;
  inbox: boolean;
  mentions: boolean;
  savedItems: boolean;
  messageSearch: boolean;
  readStates: boolean;
  customEmoji: boolean;
  stickers: boolean;
  gifPicker: boolean;
  sessions: boolean;
  accountSwitching: boolean;
  mfa: boolean;
  passkeys: boolean;
  oauth: boolean;
  pushNotifications: boolean;
  voiceDevices: boolean;
  participantModeration: boolean;
  bots: boolean;
  webhooks: boolean;
  discovery: boolean;
}

export const defaultCapabilityFlags = manifest.capabilities as BergamotCapabilityFlags;

export function createDefaultCapabilityFlags(): BergamotCapabilityFlags {
  return { ...defaultCapabilityFlags };
}

export function mergeCapabilityFlags(
  next?: Partial<BergamotCapabilityFlags> | null,
): BergamotCapabilityFlags {
  return {
    ...defaultCapabilityFlags,
    ...(next ?? {}),
  };
}
