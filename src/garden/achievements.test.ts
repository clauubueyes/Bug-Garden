import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GardenStats } from '../types/garden.ts';
import type { PlantInstance } from '../types/plant.ts';
import {
	ACHIEVEMENTS,
	evaluateAchievements,
	levelProgressLabel,
	newlyUnlocked,
	unlockedAchievements,
} from './achievements.ts';

function statsWith(overrides: Partial<GardenStats> = {}): GardenStats {
	return {
		bugsFixed: 0,
		plantsDiscovered: 0,
		gardenLevel: 1,
		gardenTitle: 'Seedling Bed',
		plantsToNextLevel: 3,
		currentStreak: 0,
		longestStreak: 0,
		rarestPlant: null,
		rarityCounts: { common: 0, rare: 0, epic: 0, legendary: 0 },
		lastPlantAt: null,
		...overrides,
	};
}

function plant(overrides: Partial<PlantInstance> = {}): PlantInstance {
	return {
		instanceId: 'i',
		speciesId: 'sprout',
		name: 'Sprout',
		rarity: 'common',
		description: 'A fresh start.',
		glyph: 'sprout',
		conditionLabel: 'Any bug fix',
		rarityReasons: [],
		rarityScore: 0,
		commitSha: 'a'.repeat(40),
		commitSubject: 'fix: something',
		obtainedAt: '2026-05-10T12:00:00.000Z',
		projectId: 'project',
		...overrides,
	};
}

describe('ACHIEVEMENTS', () => {
	it('has unique ids', () => {
		const ids = ACHIEVEMENTS.map((achievement) => achievement.id);
		assert.equal(new Set(ids).size, ids.length);
	});

	it('describes every achievement for the UI', () => {
		for (const achievement of ACHIEVEMENTS) {
			assert.ok(achievement.name.length > 0, achievement.id);
			assert.ok(achievement.description.length > 0, achievement.id);
			assert.ok(['bronze', 'silver', 'gold'].includes(achievement.tier), achievement.id);
		}
	});
});

describe('evaluateAchievements', () => {
	it('locks everything for an empty garden except nothing', () => {
		const views = evaluateAchievements(statsWith(), []);
		assert.equal(views.length, ACHIEVEMENTS.length);
		for (const view of views) {
			assert.equal(view.unlocked, false, view.id);
			assert.ok(view.progress >= 0 && view.progress <= 100, view.id);
		}
	});

	it('unlocks first bloom and hotfix hero from a single night fix', () => {
		const views = evaluateAchievements(
			statsWith({ bugsFixed: 1, plantsDiscovered: 1 }),
			[plant({ obtainedAt: '2026-05-10T23:30:00.000Z' })],
		);
		const byId = new Map(views.map((view) => [view.id, view]));
		assert.equal(byId.get('first-bloom')?.unlocked, true);
		assert.equal(byId.get('hotfix-hero')?.unlocked, true);
		assert.equal(byId.get('bug-squasher')?.progress, 10);
	});

	it('reports partial progress towards a target', () => {
		const views = evaluateAchievements(statsWith({ bugsFixed: 5, plantsDiscovered: 5 }), []);
		assert.equal(views.find((view) => view.id === 'bug-squasher')?.progress, 50);
		assert.equal(views.find((view) => view.id === 'first-bloom')?.unlocked, true);
	});

	it('counts rare and epic together for the green thumb', () => {
		const views = evaluateAchievements(
			statsWith({
				rarityCounts: { common: 0, rare: 3, epic: 2, legendary: 0 },
			}),
			[],
		);
		assert.equal(views.find((view) => view.id === 'green-thumb')?.unlocked, true);
	});

	it('unlocks the legend keeper for a single legendary plant', () => {
		const views = evaluateAchievements(
			statsWith({ rarityCounts: { common: 0, rare: 0, epic: 0, legendary: 1 } }),
			[],
		);
		assert.equal(views.find((view) => view.id === 'legend-keeper')?.unlocked, true);
	});

	it('uses the longest streak for the streak keeper', () => {
		const views = evaluateAchievements(statsWith({ longestStreak: 3 }), []);
		assert.equal(views.find((view) => view.id === 'streak-keeper')?.unlocked, true);
	});

	it('ignores a fix that is neither night nor day boundary', () => {
		const views = evaluateAchievements(statsWith({ bugsFixed: 1 }), [
			plant({ obtainedAt: '2026-05-10T12:00:00.000Z' }),
		]);
		assert.equal(views.find((view) => view.id === 'hotfix-hero')?.unlocked, false);
	});

	it('treats an unparseable date as not a night fix', () => {
		const views = evaluateAchievements(statsWith(), [plant({ obtainedAt: 'nope' })]);
		assert.equal(views.find((view) => view.id === 'hotfix-hero')?.unlocked, false);
	});
});

describe('newlyUnlocked', () => {
	it('only reports achievements not seen before', () => {
		const views = evaluateAchievements(statsWith({ bugsFixed: 1, plantsDiscovered: 1 }), [
			plant({ obtainedAt: '2026-05-10T23:30:00.000Z' }),
		]);
		const first = newlyUnlocked(views, []).map((view) => view.id);
		assert.ok(first.includes('first-bloom'));

		const second = newlyUnlocked(views, first).map((view) => view.id);
		assert.deepEqual(second, []);
	});

	it('filters the unlocked list', () => {
		const views = evaluateAchievements(statsWith({ bugsFixed: 1, plantsDiscovered: 1 }), []);
		assert.equal(unlockedAchievements(views).length, 1);
	});
});

describe('levelProgressLabel', () => {
	it('announces the next level while there is one', () => {
		assert.equal(
			levelProgressLabel(statsWith({ plantsDiscovered: 1, gardenLevel: 1, plantsToNextLevel: 2 })),
			'Level 1 · Seedling Bed · 2 to level 2',
		);
	});

	it('announces a fully grown garden at the top level', () => {
		assert.equal(
			levelProgressLabel(
				statsWith({ plantsDiscovered: 400, gardenLevel: 12, gardenTitle: 'Sakura Grove', plantsToNextLevel: null }),
			),
			'Level 12 · Sakura Grove · fully grown',
		);
	});
});