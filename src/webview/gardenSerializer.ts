import { RARITY_LABELS, type PlantInstance } from '../types/plant.ts';
import type { Garden, GardenStats } from '../types/garden.ts';
import type { GardenService } from '../garden/gardenService.ts';
import { calculateStats, plantsToNextLevel } from '../garden/gardenStats.ts';
import {
	evaluateAchievements,
	levelProgressLabel,
	type AchievementView,
} from '../garden/achievements.ts';

export interface PlantViewModel {
	instanceId: string;
	name: string;
	rarity: PlantInstance['rarity'];
	rarityLabel: string;
	description: string;
	glyph: PlantInstance['glyph'];
	conditionLabel: string;
	rarityReasons: string[];
	commitSha: string;
	commitSubject: string;
	shortSha: string;
	obtainedAt: string;
	obtainedDate: string;
	projectName: string;
}

export interface RarestPlantViewModel {
	name: string;
	glyph: PlantInstance['glyph'];
	rarity: PlantInstance['rarity'];
	rarityLabel: string;
}

export interface GardenSummaryViewModel {
	plantsDiscovered: number;
	gardenLevel: number;
	gardenTitle: string;
	levelProgressLabel: string;
	plantsToNextLevel: number | null;
	currentStreak: number;
	longestStreak: number;
	rarestPlant: RarestPlantViewModel | null;
	rarityCounts: Record<PlantInstance['rarity'], number>;
}

export interface ProjectOption {
	projectId: string;
	projectName: string;
}

export interface GardenViewModel {
	projectId: string | null;
	projectName: string;
	projects: ProjectOption[];
	plants: PlantViewModel[];
	summary: GardenSummaryViewModel;
	achievements: AchievementView[];
	hasGitHistory: boolean;
	emptyMessage: string | null;
}

/** Resolve the selection against current folders so a stale selection cannot hide an open project. */
export function serializeActiveGarden(
	gardenService: Pick<GardenService, 'getGarden'>,
	projectId: string | null,
	projects: readonly ProjectOption[],
): GardenViewModel {
	const project = projects.find((option) => option.projectId === projectId) ?? projects[0];
	if (!project) {
		return createEmptyViewModel();
	}

	const garden = gardenService.getGarden(project.projectId);
	return serializeGarden({ ...garden, projectName: project.projectName }, projects);
}

/**
 * Turns domain objects into the plain payload the webview consumes. Nothing here knows about
 * VS Code, and the output only contains primitives, so the webview never has to guard against
 * missing data. Plants are ordered newest first, which is how the garden is displayed.
 */
export function serializeGarden(garden: Garden, projects: readonly ProjectOption[] = []): GardenViewModel {
	const plants = [...garden.plants]
		.sort((a, b) => timestampOf(b) - timestampOf(a))
		.map((plant) => serializePlant(plant, garden.projectName));
	const stats = calculateStats(garden);

	return {
		projectId: garden.projectId,
		projectName: garden.projectName,
		projects: projects.map((project) => ({ ...project })),
		plants,
		summary: serializeStats(stats),
		achievements: evaluateAchievements(stats, garden.plants),
		hasGitHistory: garden.processedCommits.length > 0,
		emptyMessage: plants.length === 0 ? 'Nothing planted yet. Fix a bug and commit it.' : null,
	};
}

export function createEmptyViewModel(projects: readonly ProjectOption[] = []): GardenViewModel {
	return {
		projectId: null,
		projectName: '',
		projects: projects.map((project) => ({ ...project })),
		plants: [],
		summary: serializeStats(calculateStats(emptyGarden())),
		achievements: evaluateAchievements(calculateStats(emptyGarden()), []),
		hasGitHistory: false,
		emptyMessage: 'Open a folder to start a garden.',
	};
}

export function serializeStats(stats: GardenStats): GardenSummaryViewModel {
	const rarest = stats.rarestPlant;

	return {
		plantsDiscovered: stats.plantsDiscovered,
		gardenLevel: stats.gardenLevel,
		gardenTitle: stats.gardenTitle,
		levelProgressLabel: levelProgressLabel(stats),
		plantsToNextLevel: stats.plantsToNextLevel ?? plantsToNextLevel(stats.plantsDiscovered),
		currentStreak: stats.currentStreak,
		longestStreak: stats.longestStreak,
		rarestPlant: rarest
			? { name: rarest.name, glyph: rarest.glyph, rarity: rarest.rarity, rarityLabel: RARITY_LABELS[rarest.rarity] }
			: null,
		rarityCounts: { ...stats.rarityCounts },
	};
}

function emptyGarden(): Garden {
	return {
		projectId: '',
		projectName: '',
		plants: [],
		createdAt: new Date(0).toISOString(),
		updatedAt: new Date(0).toISOString(),
		processedCommits: [],
		lastScannedSha: null,
	};
}

export function serializePlant(plant: PlantInstance, projectName: string): PlantViewModel {
	return {
		instanceId: plant.instanceId,
		name: plant.name,
		rarity: plant.rarity,
		rarityLabel: RARITY_LABELS[plant.rarity],
		description: plant.description,
		glyph: plant.glyph,
		conditionLabel: plant.conditionLabel,
		rarityReasons: [...plant.rarityReasons],
		commitSha: plant.commitSha,
		commitSubject: plant.commitSubject,
		shortSha: plant.commitSha.slice(0, 7),
		obtainedAt: plant.obtainedAt,
		obtainedDate: formatDate(plant.obtainedAt),
		projectName,
	};
}

/** YYYY-MM-DD in UTC, so the same commit reads the same in every timezone. */
export function formatDate(isoDate: string): string {
	const timestamp = Date.parse(isoDate);
	if (Number.isNaN(timestamp)) {
		return isoDate;
	}
	return new Date(timestamp).toISOString().slice(0, 10);
}

function timestampOf(plant: PlantInstance): number {
	const timestamp = Date.parse(plant.obtainedAt);
	return Number.isNaN(timestamp) ? 0 : timestamp;
}
