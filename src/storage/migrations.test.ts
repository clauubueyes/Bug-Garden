import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrateStore } from './migrations.ts';
import { CURRENT_STORE_VERSION } from '../types/storage.ts';
import { createGarden } from '../garden/gardenManager.ts';
import type { PlantInstance } from '../types/plant.ts';

const NOW = '2026-10-05T18:00:00Z';

function plant(overrides: Partial<PlantInstance> = {}): Record<string, unknown> {
	return {
		instanceId: 'sprout:abc',
		speciesId: 'sprout',
		name: 'Sprout',
		rarity: 'common',
		description: 'A first plant',
		glyph: 'sprout',
		conditionLabel: 'Any bug fix will do',
		rarityReasons: ['Small fix'],
		rarityScore: 3,
		commitSha: 'abc',
		commitSubject: 'fix: something',
		obtainedAt: NOW,
		projectId: 'p',
		...overrides,
	};
}

function gardenPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		projectId: 'p',
		projectName: 'project',
		createdAt: NOW,
		updatedAt: NOW,
		plants: [plant()],
		processedCommits: ['abc'],
		lastScannedSha: 'abc',
		...overrides,
	};
}

describe('migrateStore', () => {
	it('returns an empty store when nothing is stored', () => {
		const result = migrateStore(undefined);
		assert.deepEqual(result.store, {
			version: CURRENT_STORE_VERSION,
			gardens: {},
			unlockedAchievements: {},
		});
		assert.deepEqual(result.warnings, []);
	});

	it('reads a valid payload', () => {
		const result = migrateStore({
			version: 1,
			gardens: { p: gardenPayload() },
		});

		assert.deepEqual(result.warnings, []);
		const garden = result.store.gardens['p'];
		assert.ok(garden);
		assert.equal(garden.plants.length, 1);
		assert.equal(garden.plants[0]?.speciesId, 'sprout');
		assert.deepEqual(garden.processedCommits, ['abc']);
		assert.equal(garden.lastScannedSha, 'abc');
	});

	it('accepts a payload without an explicit version', () => {
		const result = migrateStore({ gardens: { p: gardenPayload() } });
		assert.equal(result.store.version, CURRENT_STORE_VERSION);
		assert.ok(result.store.gardens['p']);
	});

	it('discards a payload from a newer extension version', () => {
		const result = migrateStore({ version: CURRENT_STORE_VERSION + 1, gardens: { p: gardenPayload() } });

		assert.deepEqual(result.store.gardens, {});
		assert.equal(result.warnings.length, 1);
		assert.match(result.warnings[0] ?? '', /newer than supported/);
	});

	it('survives values that are not objects', () => {
		for (const value of ['nope', 42, [1, 2, 3]]) {
			const result = migrateStore(value);
			assert.deepEqual(result.store.gardens, {});
			assert.equal(result.warnings.length, 1);
		}
	});

	it('drops a garden without the required fields', () => {
		const result = migrateStore({
			version: 1,
			gardens: { broken: { projectId: 'broken' }, good: gardenPayload() },
		});

		assert.deepEqual(Object.keys(result.store.gardens), ['good']);
		assert.match(result.warnings.join(' '), /broken/);
	});

	it('drops malformed plants but keeps the garden', () => {
		const result = migrateStore({
			version: 1,
			gardens: {
				p: gardenPayload({ plants: [plant(), { speciesId: 'tulip' }, 'garbage', null] }),
			},
		});

		const garden = result.store.gardens['p'];
		assert.equal(garden?.plants.length, 1);
		assert.match(result.warnings.join(' '), /dropped/);
	});

	it('fills in optional fields that a future version may not have written', () => {
		const minimal = { speciesId: 'tulip', commitSha: 'deadbeef', obtainedAt: NOW, rarity: 'rare' };
		const result = migrateStore({ version: 1, gardens: { p: gardenPayload({ plants: [minimal] }) } });

		const plantInstance = result.store.gardens['p']?.plants[0];
		assert.equal(plantInstance?.instanceId, 'tulip:deadbeef');
		assert.equal(plantInstance?.name, 'tulip');
		assert.equal(plantInstance?.projectId, 'p');
		assert.deepEqual(plantInstance?.rarityReasons, []);
	});

	it('rejects a plant with an unknown rarity', () => {
		const result = migrateStore({
			version: 1,
			gardens: { p: gardenPayload({ plants: [plant({ rarity: 'mythic' as never })] }) },
		});
		assert.deepEqual(result.store.gardens['p']?.plants, []);
	});

	it('normalises missing optional garden fields', () => {
		const result = migrateStore({
			version: 1,
			gardens: { p: { projectId: 'p', projectName: 'project', createdAt: NOW } },
		});

		const garden = result.store.gardens['p'];
		assert.equal(garden?.updatedAt, NOW);
		assert.equal(garden?.lastScannedSha, null);
		assert.deepEqual(garden?.plants, []);
		assert.deepEqual(garden?.processedCommits, []);
	});

	it('keeps plants produced by the garden manager', () => {
		const garden = createGarden('p', 'project', NOW);
		const result = migrateStore({ version: 1, gardens: { p: { ...garden, plants: [] } } });
		assert.deepEqual(result.store.gardens['p'], garden);
	});
});