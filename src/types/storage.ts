import type { Garden } from './garden.ts';

/** On-disk (workspaceState) shape of everything Bug Garden stores per workspace. */
export interface GardenStore {
	version: number;
	gardens: Record<string, Garden>;
}

export const STORAGE_KEY = 'bugGarden.gardens';
export const CURRENT_STORE_VERSION = 1;