import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildLogArgs, isTestPath, parseGitLog } from './commitParser.ts';

const NUL = '\x00';
const RS = '\x1e';

function record(sha: string, date: string, subject: string, numstat: readonly string[]): string {
	return `${RS}${sha}${NUL}${date}${NUL}${subject}${NUL}${numstat.join(NUL)}${NUL}${NUL}`;
}

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

describe('buildLogArgs', () => {
	it('excludes merges, asks for numstat and uses NUL separated output', () => {
		const args = buildLogArgs();
		assert.ok(args.includes('--no-merges'));
		assert.ok(args.includes('--numstat'));
		assert.ok(args.includes('-z'));
	});

	it('adds a limit and a since bound only when provided', () => {
		assert.ok(!buildLogArgs().some((arg) => arg.startsWith('-n')));
		assert.ok(!buildLogArgs().some((arg) => arg.startsWith('--since')));
		const args = buildLogArgs({ limit: 50, since: '2026-10-01' });
		assert.ok(args.includes('-n50'));
		assert.ok(args.includes('--since=2026-10-01'));
	});
});

describe('parseGitLog', () => {
	it('returns nothing for empty output', () => {
		assert.deepEqual(parseGitLog(''), []);
	});

	it('parses a commit with its numstat lines', () => {
		const output = record(SHA_A, '2026-10-05T10:15:00+02:00', 'fix: repair timestamp drift', [
			'3\t1\tsrc/time.ts',
			'12\t4\tsrc/time.test.ts',
		]);

		const [commit, ...rest] = parseGitLog(output);

		assert.equal(rest.length, 0);
		assert.ok(commit);
		assert.equal(commit.sha, SHA_A);
		assert.equal(commit.authorDate, '2026-10-05T10:15:00+02:00');
		assert.equal(commit.subject, 'fix: repair timestamp drift');
		assert.equal(commit.additions, 15);
		assert.equal(commit.deletions, 5);
		assert.equal(commit.filesChanged, 2);
		assert.equal(commit.hasTests, true);
		assert.equal(commit.isMerge, false);
	});

	it('parses several commits in order, newest first', () => {
		const output = record(SHA_B, '2026-10-06T10:15:00+02:00', 'fix: second', ['1\t0\ta.ts'])
			+ record(SHA_A, '2026-10-05T10:15:00+02:00', 'fix: first', ['1\t0\tb.ts']);

		const commits = parseGitLog(output);

		assert.equal(commits.length, 2);
		assert.equal(commits[0]?.sha, SHA_B);
		assert.equal(commits[1]?.subject, 'fix: first');
	});

	it('handles a commit without file changes', () => {
		const output = record(SHA_A, '2026-10-05T10:15:00Z', 'fix: empty commit', []);
		const [commit] = parseGitLog(output);

		assert.ok(commit);
		assert.equal(commit.filesChanged, 0);
		assert.equal(commit.additions, 0);
		assert.equal(commit.deletions, 0);
		assert.deepEqual(commit.paths, []);
		assert.equal(commit.hasTests, false);
	});

	it('treats binary files as zero lines', () => {
		const output = record(SHA_A, '2026-10-05T10:15:00Z', 'fix: binary blob', [
			'-\t-\tassets/logo.png',
		]);
		const [commit] = parseGitLog(output);

		assert.ok(commit);
		assert.equal(commit.additions, 0);
		assert.equal(commit.deletions, 0);
		assert.deepEqual(commit.paths, ['assets/logo.png']);
	});

	it('keeps the new path of a rename', () => {
		const output = record(SHA_A, '2026-10-05T10:15:00Z', 'fix: move the thing', [
			`2\t2${NUL}src/old.ts${NUL}src/new.ts`,
		]);
		const [commit] = parseGitLog(output);

		assert.ok(commit);
		assert.deepEqual(commit.paths, ['src/new.ts']);
	});

	it('ignores malformed records instead of throwing', () => {
		const output = `${RS}not-a-sha${NUL}2026-10-05T10:15:00Z${NUL}fix: nope${NUL}${NUL}`;
		assert.deepEqual(parseGitLog(output), []);
	});

	it('keeps paths with spaces intact', () => {
		const output = record(SHA_A, '2026-10-05T10:15:00Z', 'fix: spaces', [
			'1\t1\tsrc/my folder/my file.ts',
		]);
		const [commit] = parseGitLog(output);

		assert.ok(commit);
		assert.deepEqual(commit.paths, ['src/my folder/my file.ts']);
	});
});

describe('isTestPath', () => {
	it('recognises common test layouts', () => {
		const tests = [
			'tests/foo.ts',
			'test/foo.ts',
			'src/__tests__/foo.ts',
			'spec/models/user_spec.rb',
			'src/foo.test.ts',
			'src/foo.spec.tsx',
			'src/test_foo.rb',
			'src/foo_test.go',
		];
		for (const path of tests) {
			assert.equal(isTestPath(path), true, path);
		}
	});

	it('does not mistake source files for tests', () => {
		const sources = ['src/latest/foo.ts', 'src/contest/entry.ts', 'docs/testing.md', 'src/attestation.ts'];
		for (const path of sources) {
			assert.equal(isTestPath(path), false, path);
		}
	});
});