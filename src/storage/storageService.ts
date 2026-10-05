import { CURRENT_STORE_VERSION, STORAGE_KEY, type GardenStore } from '../types/storage.ts';
import { migrateStore, type MigrationResult } from './migrations.ts';
import type { Garden } from '../types/garden.ts';

/** Structural subset of `vscode.Memento`, so tests need no Extension Host. */
export interface MementoLike {
	get<T>(key: string): T | undefined;
	update(key: string, value: unknown): Thenable<void> | Promise<void>;
}

export interface StorageService {
	getGarden(projectId: string): Garden | null;
	getGardens(): Garden[];
	saveGarden(garden: Garden): Promise<void>;
	deleteGarden(projectId: string): Promise<void>;
	getUnlockedAchievements(projectId: string): string[];
	markAchievementsUnlocked(projectId: string, achievementIds: readonly string[]): Promise<void>;
	clear(): Promise<void>;
	getWarnings(): readonly string[];
}

export interface CreateStorageOptions {
	now?: () => string;
	onWarning?: (message: string) => void;
}

/**
 * Typed access to VS Code's own workspace storage. Nothing is written to disk by Bug Garden
 * and no file inside the user's repository is created.
 */
export function createStorageService(
	memento: MementoLike,
	options: CreateStorageOptions = {},
): StorageService {
	let warnings: string[] = [];
	let store: GardenStore | null = null;

	const read = (): GardenStore => {
		if (!store) {
			const result: MigrationResult = migrateStore(memento.get<unknown>(STORAGE_KEY));
			store = result.store;
			warnings = [...result.warnings];
			for (const warning of warnings) {
				options.onWarning?.(warning);
			}
		}
		return store;
	};

	const write = async (next: GardenStore): Promise<void> => {
		store = next;
		await memento.update(STORAGE_KEY, next);
	};

	return {
		getGarden: (projectId) => read().gardens[projectId] ?? null,
		getGardens: () => Object.values(read().gardens),
		saveGarden: async (garden) => {
			const current = read();
			await write({ ...current, gardens: { ...current.gardens, [garden.projectId]: garden } });
		},
		deleteGarden: async (projectId) => {
			const current = read();
			if (!current.gardens[projectId]) {
				return;
			}
			const gardens = { ...current.gardens };
			delete gardens[projectId];
			await write({ ...current, gardens });
		},
		getUnlockedAchievements: (projectId) => read().unlockedAchievements[projectId] ?? [],
		markAchievementsUnlocked: async (projectId, achievementIds) => {
			if (achievementIds.length === 0) {
				return;
			}
			const current = read();
			const merged = [...new Set([...(current.unlockedAchievements[projectId] ?? []), ...achievementIds])];
			await write({
				...current,
				unlockedAchievements: { ...current.unlockedAchievements, [projectId]: merged },
			});
		},
		clear: async () => {
			warnings = [];
			await write({ version: CURRENT_STORE_VERSION, gardens: {}, unlockedAchievements: {} });
		},
		getWarnings: () => warnings,
	};
}