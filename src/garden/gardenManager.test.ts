import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyCommits, createGarden, isProcessed } from './gardenManager.ts';
import type { CommitInfo } from '../types/commit.ts';

const NOW = '2026-10-05T18:00:00Z';

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

describe('createGarden', () => {
	it('starts empty', () => {
		const garden = createGarden('video-transcriber', 'video-transcriber', NOW);
		assert.deepEqual(garden.plants, []);
		assert.deepEqual(garden.processedCommits, []);
		assert.equal(garden.lastScannedSha, null);
		assert.equal(garden.createdAt, NOW);
	});
});

describe('applyCommits', () => {
	it('grants one plant per bug-fix commit, in order', () => {
		const garden = createGarden('p', 'p', NOW);
		const result = applyCommits(
			garden,
			[commit('a'.repeat(40)), commit('b'.repeat(40), { subject: 'hotfix: crash' })],
			NOW,
		);

		assert.equal(result.added.length, 2);
		assert.deepEqual(result.garden.processedCommits, ['a'.repeat(40), 'b'.repeat(40)]);
		assert.deepEqual(
			result.garden.plants.map((plant) => plant.commitSha),
			['a'.repeat(40), 'b'.repeat(40)],
		);
		assert.equal(result.skipped, 0);
	});

	it('never converts the same commit twice', () => {
		const garden = createGarden('p', 'p', NOW);
		const commits = [commit('a'.repeat(40))];

		const first = applyCommits(garden, commits, NOW);
		const second = applyCommits(first.garden, commits, NOW);

		assert.equal(second.added.length, 0);
		assert.equal(second.skipped, 1);
		assert.equal(second.garden.plants.length, 1);
	});

	it('ignores commits already present in the middle of a batch', () => {
		const garden = createGarden('p', 'p', NOW);
		const seeded = applyCommits(garden, [commit('b'.repeat(40))], NOW);

		const result = applyCommits(
			seeded.garden,
			[commit('a'.repeat(40)), commit('b'.repeat(40)), commit('c'.repeat(40))],
			NOW,
		);

		assert.deepEqual(result.added.map((plant) => plant.commitSha), ['a'.repeat(40), 'c'.repeat(40)]);
		assert.equal(result.skipped, 1);
	});

	it('produces the same plant when a commit is reprocessed elsewhere', () => {
		const commitToReplay = commit('a'.repeat(40));
		const first = applyCommits(createGarden('p', 'p', NOW), [commitToReplay], NOW);
		const second = applyCommits(createGarden('other', 'other', NOW), [commitToReplay], NOW);

		assert.equal(first.added[0]?.speciesId, second.added[0]?.speciesId);
		assert.equal(first.added[0]?.instanceId, second.added[0]?.instanceId);
		assert.notEqual(first.added[0]?.projectId, second.added[0]?.projectId);
	});

	it('leaves the garden untouched when there is nothing to add', () => {
		const garden = createGarden('p', 'p', '2026-10-01T00:00:00Z');
		const result = applyCommits(garden, [], '2026-10-05T18:00:00Z');

		assert.equal(result.garden.updatedAt, '2026-10-01T00:00:00Z');
		assert.deepEqual(result.garden.plants, []);
	});

	it('remembers the newest scanned commit', () => {
		const garden = createGarden('p', 'p', NOW);
		const result = applyCommits(garden, [commit('b'.repeat(40)), commit('a'.repeat(40))], NOW);
		assert.equal(result.garden.lastScannedSha, 'b'.repeat(40));
	});

	it('does not mutate the garden it receives', () => {
		const garden = createGarden('p', 'p', NOW);
		applyCommits(garden, [commit('a'.repeat(40))], NOW);

		assert.deepEqual(garden.plants, []);
		assert.deepEqual(garden.processedCommits, []);
	});

	it('exposes processed lookups', () => {
		const garden = createGarden('p', 'p', NOW);
		const seeded = applyCommits(garden, [commit('a'.repeat(40))], NOW).garden;

		assert.equal(isProcessed(seeded, 'a'.repeat(40)), true);
		assert.equal(isProcessed(seeded, 'b'.repeat(40)), false);
	});
});