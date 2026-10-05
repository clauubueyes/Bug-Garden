import type { CommitFeatures } from '../types/commit.ts';

/**
 * Reusable predicates for plant unlock conditions. New rules should compose these instead of
 * inventing new magic numbers in the catalogue.
 */
export const conditions = {
	always: (): boolean => true,
	isNightFix: (features: CommitFeatures): boolean => features.isNightFix,
	isLargeDiff: (features: CommitFeatures): boolean => features.isLargeDiff,
	isSmallDiff: (features: CommitFeatures): boolean => features.isSmallDiff,
	hasTests: (features: CommitFeatures): boolean => features.hasTests,
	isHotfix: (features: CommitFeatures): boolean => features.isHotfix,
	netRemovals: (features: CommitFeatures): boolean => features.netRemovals,
	touchesManyFiles: (features: CommitFeatures): boolean => features.filesChanged >= 8,
	addsMoreThanRemoves: (features: CommitFeatures): boolean => features.additions > features.deletions,
	all(...checks: readonly ((features: CommitFeatures) => boolean)[]): (features: CommitFeatures) => boolean {
		return (features) => checks.every((check) => check(features));
	},
	any(...checks: readonly ((features: CommitFeatures) => boolean)[]): (features: CommitFeatures) => boolean {
		return (features) => checks.some((check) => check(features));
	},
} as const;