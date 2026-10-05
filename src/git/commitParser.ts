import type { CommitInfo } from '../types/commit.ts';

const RECORD_SEPARATOR = '\x1e';
const UNIT_SEPARATOR = '\x00';
const TEST_PATH_PATTERNS = [
	/(^|\/)tests?\//i,
	/(^|\/)__tests__\//i,
	/(^|\/)spec\//i,
	/(^|\/)[^/]+[._-]?(test|spec)\.[^/]+$/i,
	/(^|\/)test_[^/]+$/i,
];

/**
 * Builds the argument list used to read history. `-z` avoids quoted paths and makes the
 * output NUL separated; the record separator keeps commits apart from their numstat lines.
 */
export function buildLogArgs(options: { limit?: number; since?: string } = {}): string[] {
	const args = [
		'log',
		'--no-merges',
		'--numstat',
		'-z',
		'--date=iso-strict',
		'--format=%x1e%H%x00%aI%x00%s',
	];
	if (options.since) {
		args.push(`--since=${options.since}`);
	}
	if (options.limit) {
		args.push(`-n${options.limit}`);
	}
	return args;
}

/** Parses the output of the command built by `buildLogArgs`. Pure, and therefore testable. */
export function parseGitLog(output: string): CommitInfo[] {
	return output
		.split(RECORD_SEPARATOR)
		.map((record) => parseRecord(record))
		.filter((commit): commit is CommitInfo => commit !== null);
}

function parseRecord(record: string): CommitInfo | null {
	const chunks = record.split(UNIT_SEPARATOR);
	const sha = chunks[0]?.trim() ?? '';
	const authorDate = chunks[1]?.trim() ?? '';
	const subject = chunks[2] ?? '';

	if (!/^[0-9a-f]{7,40}$/.test(sha) || authorDate.length === 0) {
		return null;
	}

	const { paths, additions, deletions } = readNumstat(chunks.slice(3));

	return {
		sha,
		subject: subject.trim(),
		body: '',
		authorDate,
		additions,
		deletions,
		filesChanged: paths.length,
		paths,
		hasTests: paths.some(isTestPath),
		isMerge: false,
	};
}

function readNumstat(chunks: readonly string[]): {
	paths: string[];
	additions: number;
	deletions: number;
} {
	const paths: string[] = [];
	let additions = 0;
	let deletions = 0;

	for (let index = 0; index < chunks.length; index += 1) {
		const chunk = chunks[index];
		if (!chunk) {
			continue;
		}

		const parts = chunk.split('\t');
		if (parts.length >= 3) {
			additions += toCount(parts[0]);
			deletions += toCount(parts[1]);
			paths.push(normalisePath(parts.slice(2).join('\t')));
			continue;
		}

		// Rename or copy: git emits the two paths as their own NUL terminated chunks.
		const renamed = chunks[index + 2];
		if (renamed) {
			additions += toCount(parts[0]);
			deletions += toCount(parts[1]);
			paths.push(normalisePath(renamed));
			index += 2;
		}
	}

	return { paths, additions, deletions };
}

function toCount(value: string | undefined): number {
	const parsed = Number.parseInt(value ?? '', 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalisePath(path: string): string {
	const trimmed = path.trim();
	const arrow = trimmed.lastIndexOf(' => ');
	return arrow >= 0 ? trimmed.slice(arrow + 4).trim() : trimmed;
}

export function isTestPath(path: string): boolean {
	return TEST_PATH_PATTERNS.some((pattern) => pattern.test(path));
}