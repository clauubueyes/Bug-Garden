import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateRarity, rarityAtLeast, scoreToRarity } from './rarityCalculator.ts';
import { extractFeatures } from './commitFeatures.ts';
import type { CommitInfo } from '../types/commit.ts';

function featuresFrom(overrides: Partial<CommitInfo> = {}) {
	return extractFeatures({
		sha: 'd'.repeat(40),
		subject: 'fix: repair timestamp drift',
		body: '',
		authorDate: '2026-10-05T12:00:00Z',
		additions: 3,
		deletions: 1,
		filesChanged: 1,
		paths: ['src/a.ts'],
		hasTests: false,
		isMerge: false,
		...overrides,
	});
}

describe('calculateRarity', () => {
	it('is deterministic for the same commit', () => {
		const features = featuresFrom();
		const first = calculateRarity(features);
		const second = calculateRarity(features);
		assert.deepEqual(first, second);
	});

	it('keeps a small daytime fix in the common tier', () => {
		const result = calculateRarity(featuresFrom());
		assert.equal(result.rarity, 'common');
		assert.deepEqual(result.reasons, ['Small fix']);
	});

	it('escalates a night hotfix with tests and a big diff', () => {
		const result = calculateRarity(
			featuresFrom({
				subject: 'hotfix: stop the bleeding',
				authorDate: '2026-10-05T02:10:00Z',
				additions: 120,
				deletions: 95,
				filesChanged: 9,
				hasTests: true,
			}),
		);
		assert.equal(result.rarity, 'legendary');
		assert.deepEqual(result.reasons, ['Hotfix', 'Large diff', 'Night fix (00:00-04:00 UTC)', 'Shipped with tests']);
	});

	it('rewards net removal over pure addition', () => {
		const removal = calculateRarity(featuresFrom({ additions: 1, deletions: 30, filesChanged: 4 }));
		const addition = calculateRarity(featuresFrom({ additions: 30, deletions: 1, filesChanged: 4 }));
		assert.ok(removal.score > addition.score);
		assert.ok(removal.reasons.includes('Removed more than added'));
	});

	it('never returns a negative score', () => {
		const result = calculateRarity(featuresFrom({ subject: 'fix: typo', filesChanged: 1, additions: 1, deletions: 0 }));
		assert.ok(result.score >= 0);
	});
});

describe('scoreToRarity', () => {
	it('maps the score bands to tiers', () => {
		assert.equal(scoreToRarity(0), 'common');
		assert.equal(scoreToRarity(7), 'common');
		assert.equal(scoreToRarity(8), 'rare');
		assert.equal(scoreToRarity(17), 'rare');
		assert.equal(scoreToRarity(18), 'epic');
		assert.equal(scoreToRarity(29), 'epic');
		assert.equal(scoreToRarity(30), 'legendary');
		assert.equal(scoreToRarity(99), 'legendary');
	});
});

describe('rarityAtLeast', () => {
	it('compares tiers by order', () => {
		assert.equal(rarityAtLeast('legendary', 'rare'), true);
		assert.equal(rarityAtLeast('common', 'rare'), false);
		assert.equal(rarityAtLeast('epic', 'epic'), true);
	});
});