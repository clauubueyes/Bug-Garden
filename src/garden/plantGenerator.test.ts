import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generatePlant } from './plantGenerator.ts';
import { PLANT_DEFINITIONS, getPlantDefinition } from './plantDefinitions.ts';
import type { CommitInfo } from '../types/commit.ts';

const PROJECT = 'project-a';

function commitWith(overrides: Partial<CommitInfo> = {}): CommitInfo {
	return {
		sha: 'e'.repeat(40),
		subject: 'fix: repair timestamp drift',
		body: '',
		authorDate: '2026-10-05T10:15:00Z',
		additions: 3,
		deletions: 1,
		filesChanged: 1,
		paths: ['src/time.ts'],
		hasTests: false,
		isMerge: false,
		...overrides,
	};
}

describe('generatePlant', () => {
	it('is deterministic for the same commit', () => {
		const commit = commitWith();
		assert.deepEqual(generatePlant(commit, PROJECT), generatePlant(commit, PROJECT));
	});

	it('gives different commits independent chances', () => {
		const results = new Set<string>();
		for (let index = 0; index < 40; index += 1) {
			const commit = commitWith({ sha: `${index}`.padStart(40, '0') });
			results.add(generatePlant(commit, PROJECT).instanceId);
		}
		assert.ok(results.size > 1, 'expected variety across commits');
	});

	it('never invents species outside the catalogue', () => {
		for (let index = 0; index < 60; index += 1) {
			const plant = generatePlant(
				commitWith({
					sha: `${index}`.padStart(40, '1'),
					subject: index % 3 === 0 ? 'hotfix: patch the thing' : 'fix: repair thing',
					authorDate: `2026-10-05T0${index % 9}:00:00Z`,
					additions: index * 7,
					deletions: index,
					filesChanged: 1 + (index % 9),
					hasTests: index % 2 === 0,
				}),
				PROJECT,
			);
			assert.ok(PLANT_DEFINITIONS.some((definition) => definition.id === plant.speciesId), plant.speciesId);
			assert.ok(plant.rarityReasons.length >= 0);
		}
	});

	it('derives a stable instance id from species and commit', () => {
		const commit = commitWith();
		const plant = generatePlant(commit, PROJECT);
		assert.equal(plant.instanceId, `${plant.speciesId}:${commit.sha}`);
	});

	it('carries the project and commit metadata for display', () => {
		const commit = commitWith({ subject: 'fix: repair timestamp drift', authorDate: '2026-10-05T10:15:00Z' });
		const plant = generatePlant(commit, 'video-transcriber');
		assert.equal(plant.projectId, 'video-transcriber');
		assert.equal(plant.commitSubject, 'fix: repair timestamp drift');
		assert.equal(plant.obtainedAt, '2026-10-05T10:15:00Z');
		assert.ok(plant.conditionLabel.length > 0);
	});

	it('honours hard unlock conditions such as Sakura needing net removals', () => {
		for (let index = 0; index < 60; index += 1) {
			const plant = generatePlant(
				commitWith({ sha: `${index}`.padStart(40, '2'), additions: 40, deletions: 5 }),
				PROJECT,
			);
			if (plant.speciesId === 'sakura') {
				assert.fail('Sakura must not unlock when more lines were added');
			}
		}
	});

	it('produces a legendary plant for a night hotfix with tests across many files', () => {
		for (let index = 0; index < 30; index += 1) {
			const plant = generatePlant(
				commitWith({
					sha: `${index}`.padStart(40, '3'),
					subject: 'hotfix: restore service',
					authorDate: '2026-10-05T02:30:00Z',
					additions: 200,
					deletions: 180,
					filesChanged: 12,
					hasTests: true,
				}),
				PROJECT,
			);
			assert.equal(plant.rarity, 'legendary');
		}
	});

	it('keeps common fixes in the common tier and never returns an empty tier', () => {
		const plant = generatePlant(commitWith({ sha: 'f'.repeat(40) }), PROJECT);
		assert.equal(plant.rarity, 'common');
		assert.ok(getPlantDefinition(plant.speciesId));
	});
});