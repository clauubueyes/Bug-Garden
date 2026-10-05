import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyCommit, isBugFix, matchKeywords } from './commitClassifier.ts';
import type { CommitInfo } from '../types/commit.ts';

function commitWith(subject: string, overrides: Partial<CommitInfo> = {}): CommitInfo {
	return {
		sha: 'a'.repeat(40),
		subject,
		body: '',
		authorDate: '2026-10-05T10:15:00Z',
		additions: 2,
		deletions: 1,
		filesChanged: 1,
		paths: ['src/a.ts'],
		hasTests: false,
		isMerge: false,
		...overrides,
	};
}

describe('classifyCommit', () => {
	it('accepts the documented indicators', () => {
		const subjects = [
			'fix: repair timestamp drift',
			'fix(auth): drop expired sessions',
			'bug: header overflow',
			'hotfix: production is on fire',
			'fix! public api change',
			'resolve flaky integration test',
			'resolved: customer report #42',
			'patch the leaking socket',
		];
		for (const subject of subjects) {
			assert.ok(classifyCommit(subject ? commitWith(subject) : commitWith('')), subject);
		}
	});

	it('rejects feature work and housekeeping', () => {
		const subjects = [
			'feat: add garden view',
			'feat(garden): plant the seed',
			'refactor: split the storage service',
			'chore: bump dependencies',
			'docs: document commit rules',
			'style: reformat sources',
			'add new dashboard',
			'',
		];
		for (const subject of subjects) {
			assert.equal(classifyCommit(commitWith(subject)), null, subject);
		}
	});

	it('rejects merge commits', () => {
		assert.equal(classifyCommit(commitWith('fix: merged work', { isMerge: true })), null);
	});

	it('rejects fixup and squash commits so rebases do not spam the garden', () => {
		assert.equal(classifyCommit(commitWith('fixup! fix: repair timestamp drift')), null);
		assert.equal(classifyCommit(commitWith('squash! fix: repair timestamp drift')), null);
	});

	it('rejects reverts', () => {
		assert.equal(classifyCommit(commitWith('Revert "fix: repair timestamp drift"')), null);
		assert.equal(classifyCommit(commitWith('revert: back to broken state')), null);
	});

	it('reports which keywords matched', () => {
		const signal = classifyCommit(commitWith('fix: resolve patch bug'));
		assert.ok(signal);
		assert.deepEqual([...signal.keywords], ['fix', 'bug', 'resolve', 'patch']);
	});

	it('returns the features used by the plant rules', () => {
		const signal = classifyCommit(
			commitWith('fix: repair timestamp drift', { authorDate: '2026-10-05T02:00:00Z' }),
		);
		assert.ok(signal);
		assert.equal(signal.features.isNightFix, true);
		assert.equal(signal.features.sha.length, 40);
	});

	it('rejects a commit without a sha', () => {
		assert.equal(classifyCommit(commitWith('fix: something', { sha: '  ' })), null);
	});

	it('exposes a boolean helper', () => {
		assert.equal(isBugFix(commitWith('fix: yes')), true);
		assert.equal(isBugFix(commitWith('feat: no')), false);
	});
});

describe('matchKeywords', () => {
	it('reads the conventional commit type', () => {
		assert.deepEqual([...matchKeywords('fix: broken')], ['fix']);
		assert.deepEqual([...matchKeywords('hotfix: broken')], ['fix', 'hotfix']);
		assert.deepEqual([...matchKeywords('bugfix: broken')], ['fix', 'bug']);
	});

	it('reads keywords from the rest of the subject', () => {
		assert.deepEqual([...matchKeywords('reproduce the crash')], []);
		assert.deepEqual([...matchKeywords('resolve the timeout bug')], ['bug', 'resolve']);
	});

	it('does not match keywords inside longer words', () => {
		assert.deepEqual([...matchKeywords('fixate the fixture')], []);
		assert.deepEqual([...matchKeywords('prefixed labels')], []);
	});

	it('works without a conventional prefix', () => {
		assert.deepEqual([...matchKeywords('Patch the socket leak')], ['patch']);
	});
});