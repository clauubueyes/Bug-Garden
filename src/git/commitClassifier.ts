import { extractFeatures } from '../garden/commitFeatures.ts';
import type { BugFixSignal, CommitInfo } from '../types/commit.ts';

export const FIX_KEYWORDS = ['fix', 'bug', 'hotfix', 'resolve', 'resolved', 'patch'] as const;

const KEYWORD_PATTERN = /[a-z]+/g;
const CONVENTIONAL_PREFIX = /^(?<type>[a-z]+)(?:\((?<scope>[^)]*)\))?(?<breaking>!)?:\s*/;

/**
 * Decides whether a commit is probably a bug fix. Deliberately conservative and explainable:
 * it only looks at the commit subject, so a commit never needs to be re-read to be classified.
 *
 * A commit qualifies when it mentions a fix keyword, either in the conventional commit type
 * (`fix:`, `hotfix:`, `bug(scope):`) or anywhere in the subject as a word (`fix crash on
 * startup`). Feature-only commits never qualify.
 */
export function classifyCommit(commit: CommitInfo): BugFixSignal | null {
	if (commit.isMerge || commit.sha.trim().length === 0) {
		return null;
	}

	const features = extractFeatures(commit);
	if (features.isFixup) {
		return null;
	}

	if (features.isRevert) {
		return null;
	}

	const keywords = matchKeywords(commit.subject);
	if (keywords.length === 0) {
		return null;
	}

	return { keywords, features };
}

export function isBugFix(commit: CommitInfo): boolean {
	return classifyCommit(commit) !== null;
}

/**
 * Returns the fix keywords present in a subject, in catalogue order. The conventional commit
 * type is matched loosely (`bugfix:` counts as both `bug` and `fix`) so compound types are not
 * silently ignored.
 */
export function matchKeywords(subject: string): readonly string[] {
	const prefix = CONVENTIONAL_PREFIX.exec(subject.toLowerCase());
	const type = prefix?.groups?.['type'] ?? '';
	const remainder = subject.slice(prefix?.[0].length ?? 0).toLowerCase();
	const words = new Set(remainder.match(KEYWORD_PATTERN) ?? []);

	const matches = (keyword: string): boolean =>
		words.has(keyword) || type === keyword || type.startsWith(keyword) || type.endsWith(keyword);

	return FIX_KEYWORDS.filter(matches);
}