import { RARITY_ORDER, type PlantInstance, type Rarity } from '../types/plant.ts';
import type { Garden, GardenStats } from '../types/garden.ts';

export type { GardenStats };

export interface LevelDefinition {
	level: number;
	title: string;
	/** Plants needed to reach this level. */
	plantsRequired: number;
}

/**
 * Level thresholds. Every level costs a few more plants than the previous one, so early levels
 * arrive quickly and later ones take real effort. `plantsRequired` is cumulative.
 */
export const GARDEN_LEVELS: readonly LevelDefinition[] = [
	{ level: 1, title: 'Seedling Bed', plantsRequired: 0 },
	{ level: 2, title: 'Sprout Terrace', plantsRequired: 3 },
	{ level: 3, title: 'Tulip Row', plantsRequired: 8 },
	{ level: 4, title: 'Sunflower Field', plantsRequired: 15 },
	{ level: 5, title: 'Fernhouse', plantsRequired: 25 },
	{ level: 6, title: 'Cactus Rockery', plantsRequired: 40 },
	{ level: 7, title: 'Mushroom Hollow', plantsRequired: 60 },
	{ level: 8, title: 'Lotus Pond', plantsRequired: 85 },
	{ level: 9, title: 'Monstera House', plantsRequired: 120 },
	{ level: 10, title: 'Ghost Orchid Vault', plantsRequired: 170 },
	{ level: 11, title: 'Ancient Oak Glade', plantsRequired: 240 },
	{ level: 12, title: 'Sakura Grove', plantsRequired: 340 },
];

const DAY_MS = 86_400_000;

export function calculateStats(garden: Garden): GardenStats {
	const plants = [...garden.plants].sort((a, b) => timestampOf(a) - timestampOf(b));
	const { current, longest } = calculateStreaks(plants);

	return {
		bugsFixed: plants.length,
		plantsDiscovered: plants.length,
		gardenLevel: levelFor(plants.length),
		gardenTitle: titleFor(plants.length),
		plantsToNextLevel: plantsToNextLevel(plants.length),
		currentStreak: current,
		longestStreak: longest,
		rarestPlant: findRarestPlant(plants),
		rarityCounts: countRarities(plants),
		lastPlantAt: plants.length > 0 ? plants[plants.length - 1]?.obtainedAt ?? null : null,
	};
}

export function levelFor(plantCount: number): number {
	let level = 1;
	for (const definition of GARDEN_LEVELS) {
		if (plantCount >= definition.plantsRequired) {
			level = definition.level;
		}
	}
	return level;
}

export function titleFor(plantCount: number): string {
	const level = levelFor(plantCount);
	return GARDEN_LEVELS[level - 1]?.title ?? 'Seedling Bed';
}

/** How many more plants are needed for the next level, or null at the top level. */
export function plantsToNextLevel(plantCount: number): number | null {
	const next = GARDEN_LEVELS.find((definition) => definition.plantsRequired > plantCount);
	return next ? next.plantsRequired - plantCount : null;
}

/**
 * A streak is a run of consecutive UTC days with at least one bug fix. Fixing twice on the same
 * day extends the current run rather than starting a new one.
 */
export function calculateStreaks(plants: readonly PlantInstance[]): { current: number; longest: number } {
	if (plants.length === 0) {
		return { current: 0, longest: 0 };
	}

	const days = [...new Set(plants.map((plant) => dayIndex(plant.obtainedAt)))].sort((a, b) => a - b);
	let longest = 1;
	let run = 1;
	for (let index = 1; index < days.length; index += 1) {
		const day = days[index];
		const previous = days[index - 1];
		run = day !== undefined && previous !== undefined && day === previous + 1 ? run + 1 : 1;
		longest = Math.max(longest, run);
	}

	const last = days[days.length - 1] ?? 0;
	const today = dayIndex(new Date().toISOString());
	const isTodayOrYesterday = today - last <= 1;

	return { current: isTodayOrYesterday ? run : 0, longest };
}

export function findRarestPlant(plants: readonly PlantInstance[]): PlantInstance | null {
	let rarest: PlantInstance | null = null;
	for (const plant of plants) {
		if (!rarest || rank(plant.rarity) > rank(rarest.rarity)) {
			rarest = plant;
		}
	}
	return rarest;
}

export function countRarities(plants: readonly PlantInstance[]): Record<Rarity, number> {
	const counts = Object.fromEntries(RARITY_ORDER.map((rarity) => [rarity, 0])) as Record<Rarity, number>;
	for (const plant of plants) {
		counts[plant.rarity] += 1;
	}
	return counts;
}

function rank(rarity: Rarity): number {
	return RARITY_ORDER.indexOf(rarity);
}

function dayIndex(isoDate: string): number {
	const timestamp = Date.parse(isoDate);
	return Number.isNaN(timestamp) ? 0 : Math.floor(timestamp / DAY_MS);
}

function timestampOf(plant: PlantInstance): number {
	const timestamp = Date.parse(plant.obtainedAt);
	return Number.isNaN(timestamp) ? 0 : timestamp;
}