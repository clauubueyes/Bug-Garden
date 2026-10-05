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

export interface GardenStats {
	bugsFixed: number;
	plantsDiscovered: number;
	gardenLevel: number;
	currentStreak: number;
	longestStreak: number;
	rarestPlant: PlantInstance | null;
	rarityCounts: Readonly<Record<Rarity, number>>;
}

export interface GardenSnapshot {
	garden: Garden;
	stats: GardenStats;
}