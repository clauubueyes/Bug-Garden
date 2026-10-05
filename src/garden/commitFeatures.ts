import type { CommitFeatures, CommitInfo } from '../types/commit.ts';

/** Hour window (UTC) treated as "the middle of the night". */
export const NIGHT_START_HOUR = 0;
export const NIGHT_END_HOUR = 4;

export const LARGE_DIFF_FILES = 5;
export const LARGE_DIFF_CHURN = 200;
export const SMALL_DIFF_FILES = 2;
export const SMALL_DIFF_CHURN = 20;

const TYPO_PATTERN = /\btypos?\b|\bspelling\b|\bmisspell/i;

/**
 * Turns a raw commit into the only shape the plant rules are allowed to look at. No git, no
 * VS Code, no randomness: pure and easy to reason about.
 */
export function extractFeatures(commit: CommitInfo): CommitFeatures {
	const subject = commit.subject.trim();
	const additions = Math.max(commit.additions, 0);
	const deletions = Math.max(commit.deletions, 0);
	const filesChanged = Math.max(commit.filesChanged, 0);
	const churn = additions + deletions;
	const hourUtc = extractUtcHour(commit.authorDate);

	return {
		sha: commit.sha,
		additions,
		deletions,
		filesChanged,
		churn,
		netRemovals: deletions > additions,
		hourUtc,
		isNightFix: hourUtc >= NIGHT_START_HOUR && hourUtc < NIGHT_END_HOUR,
		isLargeDiff: filesChanged >= LARGE_DIFF_FILES || churn >= LARGE_DIFF_CHURN,
		isSmallDiff: filesChanged <= SMALL_DIFF_FILES && churn <= SMALL_DIFF_CHURN,
		hasTests: commit.hasTests,
		isHotfix: /\bhotfix/i.test(subject),
		isTypoFix: TYPO_PATTERN.test(subject),
		isRevert: /^revert\b/i.test(subject),
		isFixup: /^(fixup|squash)!/i.test(subject),
	};
}

function extractUtcHour(isoDate: string): number {
	const timestamp = Date.parse(isoDate);
	if (Number.isNaN(timestamp)) {
		return 12;
	}
	return new Date(timestamp).getUTCHours();
}