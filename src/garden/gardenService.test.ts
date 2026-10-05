import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGardenService } from './gardenService.ts';
import { createStorageService, type MementoLike } from '../storage/storageService.ts';
import type { HistoryReader } from '../git/historyReader.ts';
import type { CommitInfo } from '../types/commit.ts';
import { createProjectId } from '../storage/projectKey.ts';

const WORKSPACE = `${['C:', '', 'projects', 'video-transcriber'].join('\\')}`;
const NOW = '2026-10-05T18:00:00Z';

function memento(): MementoLike {
	const data: Record<string, unknown> = {};
	return {
		get<T>(key: string): T | undefined {
			return data[key] as T | undefined;
		},
		update(key: string, value: unknown): Promise<void> {
			data[key] = value;
			return Promise.resolve();
		},
	};
}

function commit(sha: string, overrides: Partial<CommitInfo> = {}): CommitInfo {
	return {
		sha,
		subject: 'fix: repair timestamp drift',
		body: '',
		authorDate: '2026-10-05T10:15:00Z',
		additions: 3,
		deletions: 1,
		filesChanged: 1,
		paths: ['src/time.ts'],
		hasTests: false,
		isMerge: false,
		...overrides,
	};
}

function historyReaderReturning(commits: readonly CommitInfo[]): HistoryReader {
	return {
		readCommits: () => Promise.resolve([...commits]),
		readBugFixCommits: () => Promise.resolve([...commits]),
	};
}

function serviceWith(
	commits: readonly CommitInfo[],
	overrides: Partial<Parameters<typeof createGardenService>[0]> = {},
) {
	const storage = createStorageService(memento());
	const service = createGardenService({
		historyReader: historyReaderReturning(commits),
		storage,
		now: () => NOW,
		...overrides,
	});
	return { service, storage };
}

describe('gardenService.scan', () => {
	it('grows the garden from repository history and persists it', async () => {
		const { service, storage } = serviceWith([commit('a'.repeat(40)), commit('b'.repeat(40))]);

		const result = await service.scan(WORKSPACE);

		assert.equal(result.added.length, 2);
		assert.equal(result.scanned, 2);
		const projectId = createProjectId(WORKSPACE);
		assert.equal(storage.getGarden(projectId)?.plants.length, 2);
	});

	it('does not duplicate plants on a second scan', async () => {
		const { service } = serviceWith([commit('a'.repeat(40))]);

		await service.scan(WORKSPACE);
		const second = await service.scan(WORKSPACE);

		assert.equal(second.added.length, 0);
		assert.equal(second.skipped, 1);
		assert.equal(second.garden.plants.length, 1);
	});

	it('adds only the commits it has not seen', async () => {
		const first = serviceWith([commit('a'.repeat(40))]);
		await first.service.scan(WORKSPACE);

		const storage = first.storage;
		const second = createGardenService({
			historyReader: historyReaderReturning([commit('b'.repeat(40)), commit('a'.repeat(40))]),
			storage,
			now: () => NOW,
		});

		const result = await second.scan(WORKSPACE);
		assert.deepEqual(result.added.map((plant) => plant.commitSha), ['b'.repeat(40)]);
		assert.equal(result.garden.plants.length, 2);
	});

	it('uses the folder name as project name', async () => {
		const { service } = serviceWith([commit('a'.repeat(40))]);
		const result = await service.scan(WORKSPACE);
		assert.equal(result.garden.projectName, 'video-transcriber');
	});

	it('skips git entirely when the folder is not a repository', async () => {
		let reads = 0;
		const reader: HistoryReader = {
			readCommits: () => {
				reads += 1;
				return Promise.resolve([]);
			},
			readBugFixCommits: () => {
				reads += 1;
				return Promise.resolve([]);
			},
		};
		const { service } = serviceWith([], { historyReader: reader, isRepository: () => false });

		const result = await service.scan(WORKSPACE);

		assert.equal(reads, 0);
		assert.equal(result.added.length, 0);
		assert.deepEqual(result.garden.plants, []);
	});

	it('keeps one garden per project', async () => {
		const { service, storage } = serviceWith([commit('a'.repeat(40))]);
		await service.scan(WORKSPACE);
		await service.scan(`${WORKSPACE}-other`);

		assert.equal(storage.getGardens().length, 2);
	});

	it('can be given commits directly, which keeps the flow testable', async () => {
		const { service } = serviceWith([]);
		const result = await service.scan(WORKSPACE, [commit('c'.repeat(40))]);
		assert.equal(result.added.length, 1);
	});
});

describe('gardenService.scan achievements', () => {
	it('returns stats and achievements alongside the garden', async () => {
		const { service } = serviceWith([commit('a'.repeat(40))]);

		const result = await service.scan(WORKSPACE);

		assert.equal(result.stats.plantsDiscovered, 1);
		assert.equal(result.stats.bugsFixed, 1);
		assert.equal(result.achievements.length > 0, true);
	});

	it('announces an unlock once and never again', async () => {
		const { service, storage } = serviceWith([commit('a'.repeat(40))]);

		const first = await service.scan(WORKSPACE);
		const firstIds = first.newlyUnlocked.map((achievement) => achievement.id);
		assert.ok(firstIds.includes('first-bloom'), firstIds.join(','));

		const second = await service.scan(WORKSPACE);
		assert.deepEqual(second.newlyUnlocked, []);
		assert.deepEqual(storage.getUnlockedAchievements(createProjectId(WORKSPACE)).sort(), [...firstIds].sort());
	});

	it('announces unlocks for a second project independently', async () => {
		const { service } = serviceWith([commit('a'.repeat(40))]);
		await service.scan(WORKSPACE);

		const other = await service.scan(`${WORKSPACE}-other`);

		assert.ok(other.newlyUnlocked.some((achievement) => achievement.id === 'first-bloom'));
	});
});

describe('gardenService.getGarden', () => {
	it('creates an empty garden for an unknown project', () => {
		const { service } = serviceWith([]);
		const garden = service.getGarden(createProjectId(WORKSPACE));

		assert.deepEqual(garden.plants, []);
		assert.equal(garden.projectId, createProjectId(WORKSPACE));
	});

	it('exposes the project id used as storage key', () => {
		const { service } = serviceWith([]);
		assert.equal(service.getProjectId(WORKSPACE), createProjectId(WORKSPACE));
	});
});