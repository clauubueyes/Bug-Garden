import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HeadTracker } from './headTracker.ts';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

describe('HeadTracker', () => {
	it('only records a baseline on the first check', async () => {
		const changes: string[] = [];
		const tracker = new HeadTracker(() => Promise.resolve(SHA_A), (sha) => changes.push(sha));

		assert.equal(await tracker.check(), false);
		assert.equal(tracker.baseline, SHA_A);
		assert.deepEqual(changes, []);
	});

	it('reports a new HEAD once', async () => {
		let sha = SHA_A;
		const changes: string[] = [];
		const tracker = new HeadTracker(() => Promise.resolve(sha), (value) => changes.push(value));

		await tracker.check();
		sha = SHA_B;

		assert.equal(await tracker.check(), true);
		assert.equal(await tracker.check(), false);
		assert.deepEqual(changes, [SHA_B]);
		assert.equal(tracker.baseline, SHA_B);
	});

	it('ignores a missing repository', async () => {
		const tracker = new HeadTracker(
			() => Promise.resolve(null),
			() => assert.fail('should not fire'),
		);

		assert.equal(await tracker.check(), false);
		assert.equal(tracker.baseline, null);
	});

	it('does not fire again when HEAD settles on the same sha', async () => {
		const shas = [SHA_A, SHA_B, SHA_B];
		const changes: string[] = [];
		let index = 0;
		const tracker = new HeadTracker(
			() => Promise.resolve(shas[index++] ?? null),
			(sha) => changes.push(sha),
		);

		await tracker.check();
		await tracker.check();
		await tracker.check();

		assert.deepEqual(changes, [SHA_B]);
	});
});