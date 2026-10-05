/** Plain, serialisable description of a commit. Produced by the git layer only. */
export interface CommitInfo {
	sha: string;
	subject: string;
	body: string;
	authorDate: string;
	additions: number;
	deletions: number;
	filesChanged: number;
	paths: readonly string[];
	hasTests: boolean;
	isMerge: boolean;
}

/** Everything the plant rules are allowed to know about a commit. */
export interface CommitFeatures {
	sha: string;
	additions: number;
	deletions: number;
	filesChanged: number;
	churn: number;
	netRemovals: boolean;
	/** 0-23 in UTC, extracted from the commit date. */
	hourUtc: number;
	isNightFix: boolean;
	isLargeDiff: boolean;
	isSmallDiff: boolean;
	hasTests: boolean;
	isHotfix: boolean;
	isTypoFix: boolean;
	isRevert: boolean;
	isFixup: boolean;
}

export interface BugFixSignal {
	/** Keywords that matched, e.g. `fix`, `hotfix`. */
	keywords: readonly string[];
	features: CommitFeatures;
}