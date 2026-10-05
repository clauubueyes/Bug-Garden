import { execFile } from 'node:child_process';

export const DEFAULT_TIMEOUT_MS = 10_000;
export const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

export interface RunGitOptions {
	cwd: string;
	timeoutMs?: number;
	maxBuffer?: number;
	/** Extra environment variables, merged over `process.env`. */
	env?: Readonly<Record<string, string>>;
}

export class GitCommandError extends Error {
	readonly args: readonly string[];

	constructor(args: readonly string[], cause: string) {
		super(`git ${args.join(' ')} failed: ${cause}`);
		this.name = 'GitCommandError';
		this.args = args;
	}
}

/**
 * The only place in Bug Garden that spawns a process. Arguments are always passed as an
 * array so nothing in a path or a commit message can be interpreted by a shell, and the
 * call is bounded by a timeout and an output limit.
 */
export function runGit(args: readonly string[], options: RunGitOptions): Promise<string> {
	const maxBuffer = options.maxBuffer ?? MAX_OUTPUT_BYTES;

	return new Promise((resolve, reject) => {
		execFile(
			'git',
			[...args],
			{
				cwd: options.cwd,
				timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
				maxBuffer,
				windowsHide: true,
				encoding: 'utf8',
				// Read-only commands must never take the index lock in the user's repository.
				env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', ...options.env },
			},
			(error, stdout) => {
				if (error) {
					reject(new GitCommandError(args, error.message));
					return;
				}
				resolve(stdout);
			},
		);
	});
}

/**
 * Resolves the repository root for a folder, or null when it is not a git repository.
 * `ceilingDirectory` is an optional boundary passed to `GIT_CEILING_DIRECTORIES`, which stops
 * discovery before it walks above that folder. Production callers leave it out so monorepo
 * subfolders still resolve to the repository that contains them.
 */
export async function findRepositoryRoot(cwd: string, ceilingDirectory?: string): Promise<string | null> {
	try {
		const env = ceilingDirectory ? { GIT_CEILING_DIRECTORIES: ceilingDirectory } : {};
		const root = await runGit(['rev-parse', '--show-toplevel'], { cwd, env });
		const trimmed = root.trim();
		return trimmed.length > 0 ? trimmed : null;
	} catch {
		return null;
	}
}

/** Resolves the branch HEAD points at, used to notice new commits cheaply. */
export async function readHeadSha(cwd: string): Promise<string | null> {
	try {
		const sha = (await runGit(['rev-parse', 'HEAD'], { cwd })).trim();
		return /^[0-9a-f]{40}$/.test(sha) ? sha : null;
	} catch {
		return null;
	}
}