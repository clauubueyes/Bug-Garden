import { RARITY_LABELS, type PlantInstance } from '../types/plant.ts';
import type { Garden } from '../types/garden.ts';

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

export interface GardenSummaryViewModel {
	plantsDiscovered: number;
}

export interface GardenViewModel {
	projectId: string;
	projectName: string;
	plants: PlantViewModel[];
	summary: GardenSummaryViewModel;
	hasGitHistory: boolean;
	emptyMessage: string | null;
}

/**
 * Turns domain objects into the plain payload the webview consumes. Nothing here knows about
 * VS Code, and the output only contains primitives, so the webview never has to guard against
 * missing data. Plants are ordered newest first, which is how the garden is displayed.
 */
export function serializeGarden(garden: Garden): GardenViewModel {
	const plants = [...garden.plants]
		.sort((a, b) => timestampOf(b) - timestampOf(a))
		.map((plant) => serializePlant(plant, garden.projectName));

	return {
		projectId: garden.projectId,
		projectName: garden.projectName,
		plants,
		summary: { plantsDiscovered: plants.length },
		hasGitHistory: garden.processedCommits.length > 0,
		emptyMessage: plants.length === 0 ? 'Nothing planted yet. Fix a bug and commit it.' : null,
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