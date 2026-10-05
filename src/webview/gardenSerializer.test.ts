import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDate, serializeGarden, serializePlant } from './gardenSerializer.ts';
import { createGarden } from '../garden/gardenManager.ts';
import type { PlantInstance } from '../types/plant.ts';

const NOW = '2026-10-05T18:00:00Z';

const ghostOrchid: PlantInstance = {
	instanceId: 'ghost-orchid:abc1234',
	speciesId: 'ghost-orchid',
	name: 'Ghost Orchid',
	rarity: 'epic',
	description: 'Blooms once a year.',
	glyph: 'orchid',
	conditionLabel: 'Night fix across many files',
	rarityReasons: ['Night fix (00:00-04:00 UTC)'],
	rarityScore: 24,
	commitSha: 'abc1234def5678',
	commitSubject: 'fix: repair timestamp drift',
	obtainedAt: '2026-10-05T02:15:00Z',
	projectId: 'video-transcriber',
};

describe('serializePlant', () => {
	it('includes everything the details panel needs', () => {
		const model = serializePlant(ghostOrchid, 'video-transcriber');

		assert.equal(model.name, 'Ghost Orchid');
		assert.equal(model.rarityLabel, 'Epic');
		assert.equal(model.shortSha, 'abc1234');
		assert.equal(model.obtainedDate, '2026-10-05');
		assert.equal(model.commitSubject, 'fix: repair timestamp drift');
		assert.equal(model.conditionLabel, 'Night fix across many files');
		assert.equal(model.projectName, 'video-transcriber');
		assert.deepEqual(model.rarityReasons, ['Night fix (00:00-04:00 UTC)']);
	});

	it('copies arrays so the webview cannot mutate garden state', () => {
		const model = serializePlant(ghostOrchid, 'video-transcriber');
		model.rarityReasons.push('injected');
		assert.equal(ghostOrchid.rarityReasons.length, 1);
	});
});

describe('serializeGarden', () => {
	it('reports an empty garden with a message', () => {
		const model = serializeGarden(createGarden('p', 'project', NOW));

		assert.deepEqual(model.plants, []);
		assert.equal(model.summary.plantsDiscovered, 0);
		assert.equal(model.hasGitHistory, false);
		assert.match(model.emptyMessage ?? '', /Nothing planted yet/);
	});

	it('lists plants newest first', () => {
		const garden = {
			...createGarden('video-transcriber', 'video-transcriber', NOW),
			plants: [
				ghostOrchid,
				{
					...ghostOrchid,
					instanceId: 'sprout:def',
					name: 'Sprout',
					obtainedAt: '2026-10-05T18:00:00Z',
				},
			],
			processedCommits: ['abc1234def5678', 'def'],
		};

		const model = serializeGarden(garden);

		assert.deepEqual(
			model.plants.map((plant) => plant.name),
			['Sprout', 'Ghost Orchid'],
		);
		assert.equal(model.summary.plantsDiscovered, 2);
		assert.equal(model.hasGitHistory, true);
		assert.equal(model.emptyMessage, null);
	});
});

describe('formatDate', () => {
	it('formats an ISO date in UTC', () => {
		assert.equal(formatDate('2026-10-05T23:59:00+02:00'), '2026-10-05');
		assert.equal(formatDate('2026-10-05T00:30:00Z'), '2026-10-05');
	});

	it('returns the input when it cannot be parsed', () => {
		assert.equal(formatDate('whenever'), 'whenever');
	});
});