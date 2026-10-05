import type { GardenStats } from '../types/garden.ts';
import type { PlantInstance } from '../types/plant.ts';
import { levelFor, plantsToNextLevel } from '../garden/gardenStats.ts';

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export interface AchievementDefinition {
	id: string;
	name: string;
	description: string;
	tier: AchievementTier;
	icon: string;
	/** Returns progress as a percentage between 0 and 100. */
	progress: (stats: GardenStats, plants: readonly PlantInstance[]) => number;
}

/**
 * Progress based definitions. Keeping these as pure functions of the current garden means an
 * achievement can never disagree with the garden it describes, and unlocking is not stored.
 */
export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
	{
		id: 'first-bloom',
		name: 'First Bloom',
		description: 'Fix your first bug',
		tier: 'bronze',
		icon: '🌱',
		progress: (stats) => percent(stats.bugsFixed, 1),
	},
	{
		id: 'bug-squasher',
		name: 'Bug Squasher',
		description: 'Fix 10 bugs',
		tier: 'bronze',
		icon: '🪲',
		progress: (stats) => percent(stats.bugsFixed, 10),
	},
	{
		id: 'pest-control',
		name: 'Pest Control',
		description: 'Fix 25 bugs',
		tier: 'silver',
		icon: '🛡️',
		progress: (stats) => percent(stats.bugsFixed, 25),
	},
	{
		id: 'bug-hunter',
		name: 'Bug Hunter',
		description: 'Fix 50 bugs',
		tier: 'silver',
		icon: '🏹',
		progress: (stats) => percent(stats.bugsFixed, 50),
	},
	{
		id: 'legend-keeper',
		name: 'Legend Keeper',
		description: 'Grow a legendary plant',
		tier: 'silver',
		icon: '✨',
		progress: (stats) => percent(stats.rarityCounts.legendary, 1),
	},
	{
		id: 'green-thumb',
		name: 'Green Thumb',
		description: 'Grow 5 rare plants',
		tier: 'silver',
		icon: '🍀',
		progress: (stats) => percent(stats.rarityCounts.rare + stats.rarityCounts.epic, 5),
	},
	{
		id: 'hotfix-hero',
		name: 'Hotfix Hero',
		description: 'Fix a bug at night',
		tier: 'bronze',
		icon: '🌙',
		progress: (_stats, plants) => percent(plants.filter(isNight).length, 1),
	},
	{
		id: 'streak-keeper',
		name: 'Streak Keeper',
		description: 'Fix bugs on 3 consecutive days',
		tier: 'silver',
		icon: '🔥',
		progress: (stats) => percent(Math.max(stats.longestStreak, stats.currentStreak), 3),
	},
	{
		id: 'greenhouse',
		name: 'Greenhouse Owner',
		description: 'Reach garden level 5',
		tier: 'gold',
		icon: '🏡',
		progress: (stats) => percent(stats.gardenLevel, 5),
	},
	{
		id: 'botanist',
		name: 'Botanist',
		description: 'Reach garden level 8',
		tier: 'gold',
		icon: '🔬',
		progress: (stats) => percent(stats.gardenLevel, 8),
	},
];

const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 6;

export interface AchievementView {
	id: string;
	name: string;
	description: string;
	tier: AchievementTier;
	icon: string;
	progress: number;
	unlocked: boolean;
}

export function evaluateAchievements(
	stats: GardenStats,
	plants: readonly PlantInstance[],
): AchievementView[] {
	return ACHIEVEMENTS.map((achievement) => {
		const progress = clamp(achievement.progress(stats, plants));
		return {
			id: achievement.id,
			name: achievement.name,
			description: achievement.description,
			tier: achievement.tier,
			icon: achievement.icon,
			progress,
			unlocked: progress >= 100,
		};
	});
}

export function unlockedAchievements(views: readonly AchievementView[]): AchievementView[] {
	return views.filter((view) => view.unlocked);
}

/**
 * Reports achievements that just became unlocked, comparing against what was already seen.
 * The caller owns the persisted "seen" list; nothing here reads or writes storage.
 */
export function newlyUnlocked(
	views: readonly AchievementView[],
	alreadySeen: readonly string[],
): AchievementView[] {
	const seen = new Set(alreadySeen);
	return views.filter((view) => view.unlocked && !seen.has(view.id));
}

export function levelProgressLabel(stats: GardenStats): string {
	const remaining = plantsToNextLevel(stats.plantsDiscovered);
	if (remaining === null) {
		return `Level ${stats.gardenLevel} · ${stats.gardenTitle} · fully grown`;
	}
	return `Level ${stats.gardenLevel} · ${stats.gardenTitle} · ${remaining} to level ${levelFor(stats.plantsDiscovered) + 1}`;
}

function isNight(plant: PlantInstance): boolean {
	const timestamp = Date.parse(plant.obtainedAt);
	if (Number.isNaN(timestamp)) {
		return false;
	}
	const hour = new Date(timestamp).getUTCHours();
	return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

function percent(value: number, target: number): number {
	if (target <= 0) {
		return 100;
	}
	return clamp((value / target) * 100);
}

function clamp(value: number): number {
	if (Number.isNaN(value)) {
		return 0;
	}
	return Math.max(0, Math.min(100, value));
}