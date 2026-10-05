import { applyCommits, createGarden } from './gardenManager.ts';
import { createProjectId, createProjectName } from '../storage/projectKey.ts';
import type { HistoryReader } from '../git/historyReader.ts';
import type { StorageService } from '../storage/storageService.ts';
import type { CommitInfo } from '../types/commit.ts';
import type { Garden } from '../types/garden.ts';
import type { PlantInstance } from '../types/plant.ts';

export const DEFAULT_SCAN_LIMIT = 200;

export interface ScanResult {
	garden: Garden;
	added: PlantInstance[];
	/** Commits ignored because the garden already grew them. */
	skipped: number;
	scanned: number;
}

export interface GardenService {
	getProjectId(workspacePath: string): string;
	getGarden(projectId: string): Garden;
	/** Reads bug-fix commits and grows the garden with anything new. */
	scan(workspacePath: string, commits?: readonly CommitInfo[]): Promise<ScanResult>;
}

export interface GardenServiceOptions {
	historyReader: HistoryReader;
	storage: StorageService;
	now?: () => string;
	limit?: number;
	isRepository?: (workspacePath: string) => boolean;
}

/**
 * Orchestrates one scan: read history, load the garden, apply new commits, persist. It takes
 * both collaborators as parameters, so the whole flow is testable without git or VS Code.
 */
export function createGardenService(options: GardenServiceOptions): GardenService {
	const now = options.now ?? (() => new Date().toISOString());

	return {
		getProjectId: (workspacePath) => createProjectId(workspacePath),

		getGarden: (projectId) =>
			options.storage.getGarden(projectId) ?? createGarden(projectId, projectId, now()),

		scan: async (workspacePath, commits) => {
			const projectId = createProjectId(workspacePath);
			const projectName = createProjectName(workspacePath);
			const isRepository = options.isRepository?.(workspacePath) ?? true;

			const found = commits ?? (isRepository
				? await options.historyReader.readBugFixCommits(workspacePath, {
						limit: options.limit ?? DEFAULT_SCAN_LIMIT,
					})
				: []);

			const existing = options.storage.getGarden(projectId);
			const garden = existing ?? createGarden(projectId, projectName, now());
			const result = applyCommits(garden, found, now());

			await options.storage.saveGarden(result.garden);

			return {
				garden: result.garden,
				added: result.added,
				skipped: result.skipped,
				scanned: found.length,
			};
		},
	};
}