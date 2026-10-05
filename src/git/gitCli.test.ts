import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { findRepositoryRoot, readHeadSha, runGit } from './gitCli.ts';

function gitAvailable(): boolean {
	try {
		execFileSync('git', ['--version'], { stdio: 'ignore', windowsHide: true });
		return true;
	} catch {
		return false;
	}
}

const skip = gitAvailable() ? false : 'git is not available in this environment';
const directories: string[] = [];

function tempRepo(): string {
	const directory = mkdtempSync(join(tmpdir(), 'bug-garden-'));
	directories.push(directory);
	execFileSync('git', ['init', '--initial-branch=main'], { cwd: directory, stdio: 'ignore', windowsHide: true });
	execFileSync('git', ['config', 'user.email', 'garden@example.com'], { cwd: directory, stdio: 'ignore', windowsHide: true });
	execFileSync('git', ['config', 'user.name', 'Garden Test'], { cwd: directory, stdio: 'ignore', windowsHide: true });
	return directory;
}

after(() => {
	for (const directory of directories) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe('runGit', { skip }, () => {
	it('returns stdout for a successful command', async () => {
		const directory = tempRepo();
		const output = await runGit(['rev-parse', '--is-inside-work-tree'], { cwd: directory });
		assert.equal(output.trim(), 'true');
	});

	it('rejects when git fails', async () => {
		const directory = tempRepo();
		await assert.rejects(() => runGit(['rev-parse', 'does-not-exist'], { cwd: directory }), /failed/);
	});

	it('rejects when the working directory does not exist', async () => {
		await assert.rejects(() => runGit(['status'], { cwd: join(tmpdir(), 'bug-garden-missing-dir') }));
	});
});

describe('findRepositoryRoot', { skip }, () => {
	it('resolves the root of a repository', async () => {
		const directory = tempRepo();
		const root = await findRepositoryRoot(directory);
		assert.ok(root);
		assert.match(root.replace(/\\/g, '/'), /bug-garden-/);
	});

	it('returns null outside a repository', async () => {
		const directory = mkdtempSync(join(tmpdir(), 'bug-garden-plain-'));
		directories.push(directory);
		// Stop discovery at the temp root: on some machines the home directory is itself a
		// git repository, which would otherwise swallow the check.
		const root = await findRepositoryRoot(directory, tmpdir());
		assert.equal(root, null);
	});
});

describe('readHeadSha', { skip }, () => {
	it('returns null in a repository without commits', async () => {
		assert.equal(await readHeadSha(tempRepo()), null);
	});

	it('returns the full sha once a commit exists', async () => {
		const directory = tempRepo();
		execFileSync('git', ['commit', '--allow-empty', '-m', 'fix: first bug'], {
			cwd: directory,
			stdio: 'ignore',
			windowsHide: true,
		});
		const sha = await readHeadSha(directory);
		assert.match(sha ?? '', /^[0-9a-f]{40}$/);
	});
});