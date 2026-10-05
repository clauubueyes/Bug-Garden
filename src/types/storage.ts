import type { Garden } from './garden.ts';

/** On-disk (workspaceState) shape of everything Bug Garden stores per workspace. */
export interface GardenStore {
	version: number;
	gardens: Record<string, Garden>;
	/**
	 * Achievement ids already celebrated per project. Achievement state itself is always
	 * recomputed; this only remembers which unlocks were announced, so a notification is
	 * never repeated.
	 */
	unlockedAchievements: Record<string, string[]>;
}

export const STORAGE_KEY = 'bugGarden.gardens';
export const CURRENT_STORE_VERSION = 1;