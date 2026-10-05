import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractFeatures } from './commitFeatures.ts';
import type { CommitInfo } from '../types/commit.ts';

const baseCommit: CommitInfo = {
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

function commitWith(overrides: Partial<CommitInfo>): CommitInfo {
	return { ...baseCommit, ...overrides };
}

describe('extractFeatures', () => {
	it('normalises negative counters', () => {
		const features = extractFeatures(commitWith({ additions: -5, deletions: -2, filesChanged: -1 }));
		assert.equal(features.additions, 0);
		assert.equal(features.deletions, 0);
		assert.equal(features.filesChanged, 0);
		assert.equal(features.churn, 0);
	});

	it('flags net removals only when more lines are removed than added', () => {
		assert.equal(extractFeatures(commitWith({ additions: 4, deletions: 9 })).netRemovals, true);
		assert.equal(extractFeatures(commitWith({ additions: 9, deletions: 4 })).netRemovals, false);
		assert.equal(extractFeatures(commitWith({ additions: 4, deletions: 4 })).netRemovals, false);
	});

	it('reads the hour in UTC', () => {
		assert.equal(extractFeatures(commitWith({ authorDate: '2026-10-05T02:30:00Z' })).hourUtc, 2);
		assert.equal(extractFeatures(commitWith({ authorDate: '2026-10-05T23:59:00Z' })).hourUtc, 23);
	});

	it('treats 00:00-03:59 UTC as a night fix', () => {
		assert.equal(extractFeatures(commitWith({ authorDate: '2026-10-05T00:00:00Z' })).isNightFix, true);
		assert.equal(extractFeatures(commitWith({ authorDate: '2026-10-05T03:59:00Z' })).isNightFix, true);
		assert.equal(extractFeatures(commitWith({ authorDate: '2026-10-05T04:00:00Z' })).isNightFix, false);
		assert.equal(extractFeatures(commitWith({ authorDate: '2026-10-05T12:00:00Z' })).isNightFix, false);
	});

	it('falls back to a neutral hour for unparseable dates', () => {
		const features = extractFeatures(commitWith({ authorDate: 'not a date' }));
		assert.equal(features.hourUtc, 12);
		assert.equal(features.isNightFix, false);
	});

	it('detects large diffs by file count or by churn', () => {
		assert.equal(extractFeatures(commitWith({ filesChanged: 5, additions: 5, deletions: 5 })).isLargeDiff, true);
		assert.equal(extractFeatures(commitWith({ filesChanged: 1, additions: 120, deletions: 100 })).isLargeDiff, true);
		assert.equal(extractFeatures(commitWith({ filesChanged: 4, additions: 10, deletions: 10 })).isLargeDiff, false);
	});

	it('detects small diffs by file count and churn together', () => {
		assert.equal(extractFeatures(commitWith({ filesChanged: 2, additions: 10, deletions: 10 })).isSmallDiff, true);
		assert.equal(extractFeatures(commitWith({ filesChanged: 3, additions: 1, deletions: 1 })).isSmallDiff, false);
		assert.equal(extractFeatures(commitWith({ filesChanged: 1, additions: 20, deletions: 0 })).isSmallDiff, true);
		assert.equal(extractFeatures(commitWith({ filesChanged: 1, additions: 21, deletions: 0 })).isSmallDiff, false);
	});

	it('detects hotfix, typo, revert and fixup messages', () => {
		assert.equal(extractFeatures(commitWith({ subject: 'hotfix: stop the bleeding' })).isHotfix, true);
		assert.equal(extractFeatures(commitWith({ subject: 'fix: typo in readme' })).isTypoFix, true);
		assert.equal(extractFeatures(commitWith({ subject: 'fix: TYPOs everywhere' })).isTypoFix, true);
		assert.equal(extractFeatures(commitWith({ subject: 'Revert "feat: thing"' })).isRevert, true);
		assert.equal(extractFeatures(commitWith({ subject: 'fixup! fix: thing' })).isFixup, true);
		assert.equal(extractFeatures(commitWith({ subject: 'squash! feat: thing' })).isFixup, true);
		assert.equal(extractFeatures(commitWith({ subject: 'fix: real bug' })).isTypoFix, false);
	});

	it('carries the commit sha through for seeding', () => {
		assert.equal(extractFeatures(commitWith({ sha: 'b'.repeat(40) })).sha, 'b'.repeat(40));
	});
});