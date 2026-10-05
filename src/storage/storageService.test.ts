import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createStorageService, type MementoLike } from './storageService.ts';
import { STORAGE_KEY, CURRENT_STORE_VERSION } from '../types/storage.ts';
import { createGarden } from '../garden/gardenManager.ts';
import { applyCommits } from '../garden/gardenManager.ts';
import type { CommitInfo } from '../types/commit.ts';

const NOW = '2026-10-05T18:00:00Z';

function createMemento(initial: Record<string, unknown> = {}): MementoLike & { data: Record<string, unknown> } {
	const data = { ...initial };
	return {
		data,
		get<T>(key: string): T | undefined {
			return data[key] as T | undefined;
		},
		update(key: string, value: unknown): Promise<void> {
			data[key] = value;
			return Promise.resolve();
		},
	};
}

const commit: CommitInfo = {
	sha: 'a'.repeat(40),
	subject: 'fix: repair timestamp drift',
	body: '',
	authorDate: '2026-10-05T10:15:00Z',
	additions: 3,
	deletions: 1,
	filesChanged: 1,
	paths: ['src/time.ts'],
	hasTests: false,
	isMerge: false,
};

describe('createStorageService', () => {
	it('starts empty', () => {
		const service = createStorageService(createMemento());
		assert.equal(service.getGarden('p'), null);
		assert.deepEqual(service.getGardens(), []);
	});

	it('round-trips a garden through the memento', async () => {
		const memento = createMemento();
		const service = createStorageService(memento);
		const garden = applyCommits(createGarden('p', 'project', NOW), [commit], NOW).garden;

		await service.saveGarden(garden);

		assert.deepEqual(service.getGarden('p'), garden);
		assert.equal(memento.data[STORAGE_KEY] !== undefined, true);
		assert.deepEqual(service.getGardens().map((entry) => entry.projectId), ['p']);
	});

	it('keeps gardens for different projects apart', async () => {
		const service = createStorageService(createMemento());
		await service.saveGarden(createGarden('p1', 'one', NOW));
		await service.saveGarden(createGarden('p2', 'two', NOW));

		assert.equal(service.getGarden('p1')?.projectName, 'one');
		assert.equal(service.getGarden('p2')?.projectName, 'two');
		assert.equal(service.getGardens().length, 2);
	});

	it('loads gardens written by a previous session', () => {
		const memento = createMemento();
		const first = createStorageService(memento);
		const garden = applyCommits(createGarden('p', 'project', NOW), [commit], NOW).garden;
		return first.saveGarden(garden).then(() => {
			const second = createStorageService(memento);
			assert.deepEqual(second.getGarden('p'), garden);
		});
	});

	it('deletes a single garden', async () => {
		const service = createStorageService(createMemento());
		await service.saveGarden(createGarden('p1', 'one', NOW));
		await service.saveGarden(createGarden('p2', 'two', NOW));

		await service.deleteGarden('p1');

		assert.equal(service.getGarden('p1'), null);
		assert.ok(service.getGarden('p2'));
	});

	it('ignores a delete for an unknown project', async () => {
		const service = createStorageService(createMemento());
		await service.saveGarden(createGarden('p1', 'one', NOW));

		await service.deleteGarden('nope');

		assert.equal(service.getGardens().length, 1);
	});

	it('clears every garden', async () => {
		const memento = createMemento();
		const service = createStorageService(memento);
		await service.saveGarden(createGarden('p1', 'one', NOW));

		await service.clear();

		assert.deepEqual(service.getGardens(), []);
		assert.deepEqual(memento.data[STORAGE_KEY], { version: CURRENT_STORE_VERSION, gardens: {} });
	});

	it('reports warnings for a corrupted payload and keeps working', () => {
		const reported: string[] = [];
		const service = createStorageService(createMemento({ [STORAGE_KEY]: 'garbage' }), {
			onWarning: (message) => reported.push(message),
		});

		assert.deepEqual(service.getGardens(), []);
		assert.equal(service.getWarnings().length, 1);
		assert.equal(reported.length, 1);
	});
});