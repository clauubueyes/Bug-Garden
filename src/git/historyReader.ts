import { classifyCommit } from './commitClassifier.ts';
import { buildLogArgs, parseGitLog } from './commitParser.ts';
import { runGit as defaultRunGit } from './gitCli.ts';
import type { CommitInfo } from '../types/commit.ts';

export type RunGitFn = (args: readonly string[], options: { cwd: string }) => Promise<string>;

export interface ReadHistoryOptions {
	/** Maximum number of commits to read. */
	limit?: number;
	/** Only commits newer than this ISO date. */
	since?: string;
}

export interface HistoryReader {
	/** Non-merge commits, oldest first, so a garden grows in commit order. */
	readCommits(cwd: string, options?: ReadHistoryOptions): Promise<CommitInfo[]>;
	/** Only the commits that look like bug fixes, oldest first. */
	readBugFixCommits(cwd: string, options?: ReadHistoryOptions): Promise<CommitInfo[]>;
}

export function createHistoryReader(runGit: RunGitFn = defaultRunGit): HistoryReader {
	const readCommits = async (cwd: string, options: ReadHistoryOptions = {}): Promise<CommitInfo[]> => {
		const output = await runGit(buildLogArgs(options), { cwd });
		return parseGitLog(output).reverse();
	};

	return {
		readCommits,
		readBugFixCommits: async (cwd, options) =>
			(await readCommits(cwd, options)).filter((commit) => classifyCommit(commit) !== null),
	};
}