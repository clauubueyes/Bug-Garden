import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createHistoryReader } from './historyReader.ts';

const NUL = '\x00';
const RS = '\x1e';

function logOutput(
	entries: readonly { sha: string; date: string; subject: string; files?: readonly string[] }[],
): string {
	return entries
		.map(
			(entry) =>
				`${RS}${entry.sha}${NUL}${entry.date}${NUL}${entry.subject}${NUL}${(entry.files ?? ['src/a.ts'])
					.map((file) => `1\t0\t${file}`)
					.join(NUL)}${NUL}${NUL}`,
		)
		.join('');
}

const HISTORY = logOutput([
	{ sha: 'c'.repeat(40), date: '2026-10-03T10:00:00Z', subject: 'feat: add garden view' },
	{ sha: 'b'.repeat(40), date: '2026-10-02T10:00:00Z', subject: 'fix: repair timestamp drift' },
	{ sha: 'a'.repeat(40), date: '2026-10-01T10:00:00Z', subject: 'hotfix: crash on startup' },
]);

describe('historyReader', () => {
	it('returns commits oldest first', async () => {
		const reader = createHistoryReader(() => Promise.resolve(HISTORY));
		const commits = await reader.readCommits('C:/repo');

		assert.deepEqual(
			commits.map((commit) => commit.subject),
			['hotfix: crash on startup', 'fix: repair timestamp drift', 'feat: add garden view'],
		);
	});

	it('keeps only bug fixes', async () => {
		const reader = createHistoryReader(() => Promise.resolve(HISTORY));
		const commits = await reader.readBugFixCommits('C:/repo');

		assert.deepEqual(
			commits.map((commit) => commit.subject),
			['hotfix: crash on startup', 'fix: repair timestamp drift'],
		);
	});

	it('forwards read options to git', async () => {
		const calls: string[][] = [];
		const reader = createHistoryReader((args) => {
			calls.push([...args]);
			return Promise.resolve('');
		});
		await reader.readCommits('C:/repo', { limit: 10, since: '2026-10-01' });

		assert.equal(calls.length, 1);
		assert.ok(calls[0]?.includes('-n10'));
		assert.ok(calls[0]?.includes('--since=2026-10-01'));
	});

	it('propagates git failures to the caller', async () => {
		const reader = createHistoryReader(() => Promise.reject(new Error('git exploded')));
		await assert.rejects(() => reader.readCommits('C:/repo'), /git exploded/);
	});
});