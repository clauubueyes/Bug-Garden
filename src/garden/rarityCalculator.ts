import { createSeededRandom } from '../utils/seededRandom.ts';
import type { CommitFeatures } from '../types/commit.ts';
import { RARITY_ORDER, type Rarity } from '../types/plant.ts';

export interface RarityRule {
	id: string;
	label: string;
	score: number;
	appliesTo: (features: CommitFeatures) => boolean;
}

export const RARITY_RULES: readonly RarityRule[] = [
	{
		id: 'hotfix',
		label: 'Hotfix',
		score: 12,
		appliesTo: (features) => features.isHotfix,
	},
	{
		id: 'large-diff',
		label: 'Large diff',
		score: 10,
		appliesTo: (features) => features.isLargeDiff,
	},
	{
		id: 'night-fix',
		label: 'Night fix (00:00-04:00 UTC)',
		score: 14,
		appliesTo: (features) => features.isNightFix,
	},
	{
		id: 'test-coverage',
		label: 'Shipped with tests',
		score: 8,
		appliesTo: (features) => features.hasTests,
	},
	{
		id: 'net-removal',
		label: 'Removed more than added',
		score: 6,
		appliesTo: (features) => features.netRemovals,
	},
	{
		id: 'small-diff',
		label: 'Small fix',
		score: -4,
		appliesTo: (features) => features.isSmallDiff,
	},
];

/**
 * Rarity is a score, not a coin flip. Feature rules add and subtract points; a small seeded
 * jitter derived from the commit SHA breaks ties so the garden does not feel mechanical.
 * The same commit always scores the same.
 */
export function calculateRarity(features: CommitFeatures): { rarity: Rarity; score: number; reasons: string[] } {
	const matched = RARITY_RULES.filter((rule) => rule.appliesTo(features));
	const ruleScore = matched.reduce((total, rule) => total + rule.score, 0);
	const jitter = createSeededRandom(`${features.sha}:rarity`).int(0, 6);
	const score = Math.max(ruleScore, 0) + jitter;

	return {
		rarity: scoreToRarity(score),
		score,
		reasons: matched.map((rule) => rule.label),
	};
}

export function scoreToRarity(score: number): Rarity {
	if (score >= 30) {
		return 'legendary';
	}
	if (score >= 18) {
		return 'epic';
	}
	if (score >= 8) {
		return 'rare';
	}
	return 'common';
}

export function rarityAtLeast(rarity: Rarity, minimum: Rarity): boolean {
	return RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf(minimum);
}