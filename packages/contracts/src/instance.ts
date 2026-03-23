import manifest from "../data/instance-manifest.json";
import type { BergamotCapabilityFlags } from "./capabilities";

export interface BergamotProductDescriptor {
  name: string;
  tagline: string;
}

export interface BergamotServiceEndpoints {
  httpBaseUrl: string;
  apiBaseUrl: string;
  websocketBaseUrl: string;
  uploadsBaseUrl: string;
  mediaBaseUrl: string | null;
  adminBaseUrl: string | null;
  livekitBaseUrl: string | null;
}

export interface BergamotRuntimeConfig {
  manifestVersion: number;
  product: BergamotProductDescriptor;
  services: BergamotServiceEndpoints;
}

export interface BergamotRouteManifest {
  login: string;
  register: string;
  dmHome: string;
  notifications: string;
  favorites: string;
}

export interface BergamotFeatureManifest {
  manifestVersion: number;
  product: BergamotProductDescriptor;
  capabilities: BergamotCapabilityFlags;
  routes: BergamotRouteManifest;
}

export const defaultProductDescriptor = manifest.product as BergamotProductDescriptor;
