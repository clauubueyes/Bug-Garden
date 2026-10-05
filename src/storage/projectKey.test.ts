import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createProjectId, createProjectName } from './projectKey.ts';
import { sep } from 'node:path';

describe('createProjectId', () => {
	it('normalises separators and trailing slashes', () => {
		const id = createProjectId(`${sep}projects${sep}garden${sep}`);
		assert.ok(!id.includes('\\'), id);
		assert.ok(!id.endsWith('/'), id);
	});

	it('is stable for the same folder', () => {
		assert.equal(createProjectId(`${sep}projects${sep}garden`), createProjectId(`${sep}projects${sep}garden`));
	});

	it('is case insensitive on case insensitive platforms', () => {
		const upper = createProjectId(`${sep}projects${sep}Garden`);
		const lower = createProjectId(`${sep}projects${sep}garden`);
		if (process.platform === 'linux') {
			assert.notEqual(upper, lower);
		} else {
			assert.equal(upper, lower);
		}
	});

	it('keeps different folders apart', () => {
		assert.notEqual(createProjectId(`${sep}a${sep}garden`), createProjectId(`${sep}b${sep}garden`));
	});

	it('resolves relative paths instead of storing them', () => {
		assert.ok(createProjectId('.').length > 0);
		assert.equal(createProjectId('.'), createProjectId('.'));
	});
});

describe('createProjectName', () => {
	it('uses the folder name', () => {
		assert.equal(createProjectName(`${sep}projects${sep}video-transcriber`), 'video-transcriber');
	});

	it('falls back when the path has no name', () => {
		assert.equal(typeof createProjectName(`${sep}`), 'string');
	});
});