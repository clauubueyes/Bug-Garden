import { CURRENT_STORE_VERSION, type GardenStore } from '../types/storage.ts';
import { RARITY_ORDER, type PlantInstance, type Rarity } from '../types/plant.ts';
import type { Garden } from '../types/garden.ts';

export interface Migration {
	/** Version this migration produces. */
	toVersion: number;
	migrate: (payload: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Ordered migration steps. Empty today: the first schema version is version 1 and nothing has
 * shipped yet. Adding a step here is the only thing needed to evolve the stored shape, and
 * `migrateStore` applies the chain from the stored version up to `CURRENT_STORE_VERSION`.
 */
export const MIGRATIONS: readonly Migration[] = [];

export interface MigrationResult {
	store: GardenStore;
	/** Problems found while reading the payload, e.g. plants that were dropped. */
	warnings: string[];
}

/**
 * Reads whatever is in storage and returns a valid store. Unknown or unreadable data never
 * throws: a corrupted garden must not break activation, so bad entries are dropped and
 * reported as warnings.
 */
export function migrateStore(raw: unknown): MigrationResult {
	const warnings: string[] = [];
	if (!isRecord(raw)) {
		return { store: emptyStore(), warnings: raw === undefined ? [] : ['stored payload is not an object'] };
	}

	const version = readVersion(raw);
	if (version > CURRENT_STORE_VERSION) {
		warnings.push(
			`stored payload version ${version} is newer than supported version ${CURRENT_STORE_VERSION}; starting a new garden`,
		);
		return { store: emptyStore(), warnings };
	}

	let payload = raw;
	for (const migration of MIGRATIONS) {
		if (migration.toVersion > version) {
			payload = migration.migrate(payload);
		}
	}

	const gardens = readGardens(payload.gardens, warnings);
	return { store: { version: CURRENT_STORE_VERSION, gardens }, warnings };
}

function readVersion(payload: Record<string, unknown>): number {
	const version = payload['version'];
	return typeof version === 'number' && Number.isInteger(version) && version >= 1 ? version : 1;
}

function readGardens(value: unknown, warnings: string[]): Record<string, Garden> {
	if (!isRecord(value)) {
		return {};
	}

	const gardens: Record<string, Garden> = {};
	for (const [key, garden] of Object.entries(value)) {
		const parsed = readGarden(garden, key, warnings);
		if (parsed) {
			gardens[key] = parsed;
		}
	}
	return gardens;
}

function readGarden(value: unknown, key: string, warnings: string[]): Garden | null {
	if (!isRecord(value)) {
		warnings.push(`garden "${key}" is not an object and was ignored`);
		return null;
	}

	const projectId = readString(value, 'projectId');
	const projectName = readString(value, 'projectName');
	const createdAt = readString(value, 'createdAt');
	const updatedAt = readString(value, 'updatedAt') || createdAt;
	if (!projectId || !projectName || !createdAt) {
		warnings.push(`garden "${key}" is missing required fields and was ignored`);
		return null;
	}

	return {
		projectId,
		projectName,
		createdAt,
		updatedAt,
		plants: readPlants(value['plants'], projectId, warnings),
		processedCommits: readStringArray(value['processedCommits']),
		lastScannedSha: readString(value, 'lastScannedSha') || null,
	};
}

function readPlants(value: unknown, projectId: string, warnings: string[]): PlantInstance[] {
	if (!Array.isArray(value)) {
		return [];
	}

	const plants: PlantInstance[] = [];
	for (const entry of value) {
		const plant = readPlant(entry, projectId);
		if (plant) {
			plants.push(plant);
		} else {
			warnings.push(`a plant in garden "${projectId}" was malformed and was dropped`);
		}
	}
	return plants;
}

function readPlant(value: unknown, fallbackProjectId: string): PlantInstance | null {
	if (!isRecord(value)) {
		return null;
	}

	const speciesId = readString(value, 'speciesId');
	const commitSha = readString(value, 'commitSha');
	const obtainedAt = readString(value, 'obtainedAt');
	const rarity = readRarity(value['rarity']);
	if (!speciesId || !commitSha || !obtainedAt || !rarity) {
		return null;
	}

	return {
		instanceId: readString(value, 'instanceId') || `${speciesId}:${commitSha}`,
		speciesId,
		name: readString(value, 'name') || speciesId,
		rarity,
		description: readString(value, 'description'),
		glyph: (readString(value, 'glyph') || 'sprout') as PlantInstance['glyph'],
		conditionLabel: readString(value, 'conditionLabel'),
		rarityReasons: readStringArray(value['rarityReasons']),
		rarityScore: readNumber(value['rarityScore']),
		commitSha,
		commitSubject: readString(value, 'commitSubject'),
		obtainedAt,
		projectId: readString(value, 'projectId') || fallbackProjectId,
	};
}

function emptyStore(): GardenStore {
	return { version: CURRENT_STORE_VERSION, gardens: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string {
	const value = record[key];
	return typeof value === 'string' ? value : '';
}

function readStringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function readNumber(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readRarity(value: unknown): Rarity | null {
	return typeof value === 'string' && (RARITY_ORDER as readonly string[]).includes(value)
		? (value as Rarity)
		: null;
}