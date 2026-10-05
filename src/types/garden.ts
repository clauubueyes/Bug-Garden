import type { PlantInstance, Rarity } from './plant.ts';

/** One garden per workspace folder/project. */
export interface Garden {
	projectId: string;
	projectName: string;
	plants: readonly PlantInstance[];
	createdAt: string;
	updatedAt: string;
	/** Commit SHAs already converted into plants. Duplicate protection. */
	processedCommits: readonly string[];
	lastScannedSha: string | null;
}

/** Derived from a garden on demand. Never persisted: it must stay recomputable. */
export interface GardenStats {
	bugsFixed: number;
	plantsDiscovered: number;
	gardenLevel: number;
	gardenTitle: string;
	/** Plants still needed for the next level, or null at the top level. */
	plantsToNextLevel: number | null;
	currentStreak: number;
	longestStreak: number;
	rarestPlant: PlantInstance | null;
	rarityCounts: Readonly<Record<Rarity, number>>;
	lastPlantAt: string | null;
}

export interface GardenSnapshot {
	garden: Garden;
	stats: GardenStats;
}