import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PlantInstance, Rarity } from '../types/plant.ts';
import type { Garden } from '../types/garden.ts';
import {
	calculateStats,
	calculateStreaks,
	findRarestPlant,
	GARDEN_LEVELS,
	levelFor,
	plantsToNextLevel,
	titleFor,
} from './gardenStats.ts';

const NOW = '2026-05-10T12:00:00.000Z';

function plant(id: string, overrides: Partial<PlantInstance> = {}): PlantInstance {
	return {
		instanceId: id,
		speciesId: 'sprout',
		name: 'Sprout',
		rarity: 'common',
		description: 'A fresh start.',
		glyph: 'sprout',
		conditionLabel: 'Any bug fix',
		rarityReasons: [],
		rarityScore: 0,
		commitSha: id.padEnd(40, '0'),
		commitSubject: `fix: issue ${id}`,
		obtainedAt: NOW,
		projectId: 'project',
		...overrides,
	};
}

function gardenOf(plants: PlantInstance[]): Garden {
	return {
		projectId: 'project',
		projectName: 'project',
		plants,
		createdAt: '2026-05-01T00:00:00.000Z',
		updatedAt: '2026-05-10T00:00:00.000Z',
		processedCommits: plants.map((plant) => plant.commitSha),
		lastScannedSha: null,
	};
}

describe('garden levels', () => {
	it('keeps levels strictly increasing and starting at zero plants', () => {
		assert.equal(GARDEN_LEVELS[0]?.plantsRequired, 0);
		assert.equal(GARDEN_LEVELS[0]?.level, 1);
		for (let index = 1; index < GARDEN_LEVELS.length; index += 1) {
			const previous = GARDEN_LEVELS[index - 1];
			const current = GARDEN_LEVELS[index];
			assert.ok(previous && current);
			assert.ok(
				current.plantsRequired > previous.plantsRequired,
				`level ${current.level} needs more plants than level ${previous.level}`,
			);
			assert.equal(current.level, previous.level + 1);
		}
	});

	it('awards a level as soon as its threshold is reached', () => {
		assert.equal(levelFor(0), 1);
		assert.equal(levelFor(2), 1);
		assert.equal(levelFor(3), 2);
		assert.equal(levelFor(7), 2);
		assert.equal(levelFor(8), 3);
		assert.equal(levelFor(1000), GARDEN_LEVELS.length);
	});

	it('names the garden after its level', () => {
		assert.equal(titleFor(0), 'Seedling Bed');
		assert.equal(titleFor(3), 'Sprout Terrace');
		assert.equal(titleFor(1000), 'Sakura Grove');
	});

	it('reports how many plants remain until the next level', () => {
		assert.equal(plantsToNextLevel(0), 3);
		assert.equal(plantsToNextLevel(2), 1);
		assert.equal(plantsToNextLevel(3), 5);
		assert.equal(plantsToNextLevel(1000), null);
	});
});

describe('calculateStreaks', () => {
	const today = new Date().toISOString();

	function daysAgo(days: number): string {
		const date = new Date(`${today.slice(0, 10)}T12:00:00.000Z`);
		date.setUTCDate(date.getUTCDate() - days);
		return date.toISOString();
	}

	it('returns zero for an empty garden', () => {
		assert.deepEqual(calculateStreaks([]), { current: 0, longest: 0 });
	});

	it('counts consecutive days and treats same-day fixes as one day', () => {
		const plants = [plant('a', { obtainedAt: daysAgo(2) }), plant('b', { obtainedAt: daysAgo(2) }), plant('c', { obtainedAt: daysAgo(1) })];
		assert.deepEqual(calculateStreaks(plants), { current: 2, longest: 2 });
	});

	it('keeps the streak alive when the last fix was yesterday', () => {
		const plants = [plant('a', { obtainedAt: daysAgo(1) }), plant('b', { obtainedAt: daysAgo(2) })];
		assert.deepEqual(calculateStreaks(plants), { current: 2, longest: 2 });
	});

	it('ends the current streak after two idle days but keeps the longest', () => {
		const plants = [plant('a', { obtainedAt: daysAgo(5) }), plant('b', { obtainedAt: daysAgo(4) }), plant('c', { obtainedAt: daysAgo(3) }), plant('d', { obtainedAt: daysAgo(1) })];
		assert.deepEqual(calculateStreaks(plants), { current: 1, longest: 3 });
	});

	it('handles a single plant today', () => {
		assert.deepEqual(calculateStreaks([plant('a', { obtainedAt: today })]), { current: 1, longest: 1 });
	});
});

describe('findRarestPlant', () => {
	it('returns null for an empty garden', () => {
		assert.equal(findRarestPlant([]), null);
	});

	it('prefers legendary over every other rarity', () => {
		const rarest = findRarestPlant([
			plant('a', { rarity: 'epic' }),
			plant('b', { rarity: 'common' }),
			plant('c', { rarity: 'legendary' }),
			plant('d', { rarity: 'rare' }),
		]);
		assert.equal(rarest?.instanceId, 'c');
	});

	it('keeps the first plant when rarities tie', () => {
		const rarest = findRarestPlant([plant('a', { rarity: 'rare' }), plant('b', { rarity: 'rare' })]);
		assert.equal(rarest?.instanceId, 'a');
	});
});

describe('calculateStats', () => {
	it('summarises an empty garden', () => {
		const stats = calculateStats(gardenOf([]));
		assert.equal(stats.bugsFixed, 0);
		assert.equal(stats.plantsDiscovered, 0);
		assert.equal(stats.gardenLevel, 1);
		assert.equal(stats.gardenTitle, 'Seedling Bed');
		assert.equal(stats.plantsToNextLevel, 3);
		assert.equal(stats.currentStreak, 0);
		assert.equal(stats.longestStreak, 0);
		assert.equal(stats.rarestPlant, null);
		assert.equal(stats.lastPlantAt, null);
		assert.deepEqual(stats.rarityCounts, { common: 0, rare: 0, epic: 0, legendary: 0 });
	});

	it('counts plants, rarities and the most recent plant', () => {
		const stats = calculateStats(
			gardenOf([
				plant('a', { rarity: 'common' as Rarity, obtainedAt: '2026-05-01T10:00:00.000Z' }),
				plant('b', { rarity: 'rare' as Rarity, obtainedAt: '2026-05-02T10:00:00.000Z' }),
				plant('c', { rarity: 'rare' as Rarity, obtainedAt: '2026-05-03T10:00:00.000Z' }),
				plant('d', { rarity: 'legendary' as Rarity, obtainedAt: '2026-05-04T10:00:00.000Z' }),
			]),
		);

		assert.equal(stats.bugsFixed, 4);
		assert.equal(stats.plantsDiscovered, 4);
		assert.equal(stats.gardenLevel, 2);
		assert.equal(stats.gardenTitle, 'Sprout Terrace');
		assert.equal(stats.plantsToNextLevel, 4);
		assert.equal(stats.longestStreak, 4);
		assert.equal(stats.rarestPlant?.instanceId, 'd');
		assert.equal(stats.lastPlantAt, '2026-05-04T10:00:00.000Z');
		assert.deepEqual(stats.rarityCounts, { common: 1, rare: 2, epic: 0, legendary: 1 });
	});

	it('treats an invalid date as the oldest possible plant', () => {
		const stats = calculateStats(
			gardenOf([
				plant('a', { obtainedAt: 'not-a-date' }),
				plant('b', { obtainedAt: '2026-05-04T10:00:00.000Z' }),
			]),
		);
		assert.equal(stats.lastPlantAt, '2026-05-04T10:00:00.000Z');
	});
});