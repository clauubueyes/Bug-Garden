import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEmptyViewModel, formatDate, serializeActiveGarden, serializeGarden, serializePlant } from './gardenSerializer.ts';
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
		assert.equal(model.catalogue.length, 11);
		assert.ok(model.catalogue.every((species) => species.count === 0 && species.conditionLabel.length > 0));
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

	it('summarises levels, streaks and rarest plant for the header', () => {
		const garden = {
			...createGarden('p', 'project', NOW),
			plants: [
				ghostOrchid,
				{ ...ghostOrchid, instanceId: 'sprout:def', name: 'Sprout', rarity: 'common' as const },
				{
					...ghostOrchid,
					instanceId: 'tulip:ghi',
					name: 'Tulip',
					rarity: 'rare' as const,
					obtainedAt: '2026-10-04T02:15:00Z',
				},
			],
			processedCommits: ['abc1234def5678', 'def', 'ghi'],
		};

		const model = serializeGarden(garden);

		assert.equal(model.summary.plantsDiscovered, 3);
		assert.equal(model.summary.gardenLevel, 2);
		assert.equal(model.summary.gardenTitle, 'Sprout Terrace');
		assert.equal(model.summary.plantsToNextLevel, 5);
		assert.match(model.summary.levelProgressLabel, /Level 2 · Sprout Terrace · 5 to level 3/);
		assert.equal(model.summary.rarestPlant?.name, 'Ghost Orchid');
		assert.equal(model.summary.rarestPlant?.rarity, 'epic');
		assert.equal(model.summary.rarestPlant?.rarityLabel, 'Epic');
		assert.deepEqual(model.summary.rarityCounts, { common: 1, rare: 1, epic: 1, legendary: 0 });
	});

	it('sends achievements with the snapshot', () => {
		const garden = {
			...createGarden('p', 'project', NOW),
			plants: [ghostOrchid],
			processedCommits: ['abc1234def5678'],
		};

		const model = serializeGarden(garden);
		const firstBloom = model.achievements.find((achievement) => achievement.id === 'first-bloom');

		assert.equal(firstBloom?.unlocked, true);
		for (const achievement of model.achievements) {
			assert.ok(achievement.progress >= 0 && achievement.progress <= 100, achievement.id);
		}
	});

	it('counts collected species by their stable id and includes undiscovered species', () => {
		const garden = { ...createGarden('p', 'project', NOW), plants: [ghostOrchid,
			{ ...ghostOrchid, instanceId: 'renamed', name: 'My renamed orchid' }] };
		const catalogue = serializeGarden(garden).catalogue;
		assert.equal(catalogue.find((species) => species.id === 'ghost-orchid')?.count, 2);
		assert.equal(catalogue.find((species) => species.id === 'sprout')?.count, 0);
		assert.equal(catalogue.reduce((sum, species) => sum + species.count, 0), 2);
	});

	it('includes the project list for multi root workspaces', () => {
		const model = serializeGarden(createGarden('p', 'project', NOW), [
			{ projectId: 'p', projectName: 'project' },
			{ projectId: 'other', projectName: 'other-project' },
		]);

		assert.deepEqual(model.projects, [
			{ projectId: 'p', projectName: 'project' },
			{ projectId: 'other', projectName: 'other-project' },
		]);
	});
});

describe('createEmptyViewModel', () => {
	it('describes a workspace with no folder open', () => {
		const model = createEmptyViewModel([{ projectId: 'p', projectName: 'project' }]);

		assert.equal(model.projectId, null);
		assert.deepEqual(model.plants, []);
		assert.equal(model.summary.plantsDiscovered, 0);
		assert.equal(model.summary.gardenLevel, 1);
		assert.equal(model.summary.rarestPlant, null);
		assert.equal(model.projects.length, 1);
		assert.match(model.emptyMessage ?? '', /Open a folder/);
		for (const achievement of model.achievements) {
			assert.equal(achievement.unlocked, false, achievement.id);
		}
	});
});

describe('serializeActiveGarden', () => {
	const projects = [
		{ projectId: 'p', projectName: 'project' },
		{ projectId: 'other', projectName: 'other-project' },
	];
	const gardenService = {
		getGarden: (projectId: string) => ({
			...createGarden(projectId, projectId, NOW),
			plants: [{ ...ghostOrchid, projectId }],
			processedCommits: [ghostOrchid.commitSha],
		}),
	};

	it('shows the garden when a folder opens after an empty workspace', () => {
		const empty = serializeActiveGarden(gardenService, null, []);
		assert.match(empty.emptyMessage ?? '', /Open a folder/);

		const opened = serializeActiveGarden(gardenService, null, projects);
		assert.equal(opened.projectId, 'p');
		assert.equal(opened.projectName, 'project');
		assert.equal(opened.plants.length, 1);
		assert.equal(opened.emptyMessage, null);
	});

	it('keeps the selected project while its folder is open', () => {
		const model = serializeActiveGarden(gardenService, 'other', projects);
		assert.equal(model.projectId, 'other');
		assert.equal(model.projectName, 'other-project');
	});

	it('switches to an open folder when the selected project was removed', () => {
		const model = serializeActiveGarden(gardenService, 'removed', projects);
		assert.equal(model.projectId, 'p');
		assert.equal(model.projectName, 'project');
	});

	it('shows the empty workspace when the last folder is closed', () => {
		const model = serializeActiveGarden({
			getGarden: () => assert.fail('a closed project must not be loaded'),
		}, 'p', []);
		assert.equal(model.projectId, null);
		assert.deepEqual(model.plants, []);
		assert.match(model.emptyMessage ?? '', /Open a folder/);
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
