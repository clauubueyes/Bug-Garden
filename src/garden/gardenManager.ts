import { generatePlant } from './plantGenerator.ts';
import type { Garden } from '../types/garden.ts';
import type { CommitInfo } from '../types/commit.ts';
import type { PlantInstance } from '../types/plant.ts';

export interface ApplyCommitsResult {
	garden: Garden;
	/** Plants granted by this call, in commit order. */
	added: PlantInstance[];
	/** Commits skipped because the garden already contained them. */
	skipped: number;
}

/**
 * The only writer of garden state. It enforces the two invariants that keep a garden honest:
 * a commit is converted into a plant at most once, and the same commit always produces the
 * same plant.
 */
export function applyCommits(garden: Garden, commits: readonly CommitInfo[], now: string): ApplyCommitsResult {
	const processed = new Set(garden.processedCommits);
	const plants = [...garden.plants];
	const added: PlantInstance[] = [];
	let skipped = 0;

	for (const commit of commits) {
		if (processed.has(commit.sha)) {
			skipped += 1;
			continue;
		}

		const plant = generatePlant(commit, garden.projectId);
		processed.add(commit.sha);
		plants.push(plant);
		added.push(plant);
	}

	const hasChanges = added.length > 0;
	return {
		garden: {
			...garden,
			plants,
			processedCommits: [...processed],
			lastScannedSha: commits[0]?.sha ?? garden.lastScannedSha,
			updatedAt: hasChanges ? now : garden.updatedAt,
		},
		added,
		skipped,
	};
}

export function createGarden(projectId: string, projectName: string, now: string): Garden {
	return {
		projectId,
		projectName,
		plants: [],
		createdAt: now,
		updatedAt: now,
		processedCommits: [],
		lastScannedSha: null,
	};
}

export function isProcessed(garden: Garden, sha: string): boolean {
	return garden.processedCommits.includes(sha);
}