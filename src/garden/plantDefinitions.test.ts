import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PLANT_DEFINITIONS, getPlantDefinition, getDefinitionsByRarity, isEligible } from './plantDefinitions.ts';
import { RARITY_ORDER } from '../types/plant.ts';
import { extractFeatures } from './commitFeatures.ts';
import type { CommitInfo } from '../types/commit.ts';

const PLANT_IDS = [
	'sprout',
	'tulip',
	'sunflower',
	'fern',
	'cactus',
	'mushroom',
	'lotus',
	'monstera',
	'ghost-orchid',
	'ancient-oak',
	'sakura',
] as const;

const GLYPHS = new Set(PLANT_DEFINITIONS.map((definition) => definition.glyph));

function featuresFrom(overrides: Partial<CommitInfo>) {
	return extractFeatures({
		sha: 'c'.repeat(40),
		subject: 'fix: something',
		body: '',
		authorDate: '2026-10-05T12:00:00Z',
		additions: 5,
		deletions: 2,
		filesChanged: 1,
		paths: ['src/a.ts'],
		hasTests: false,
		isMerge: false,
		...overrides,
	});
}

describe('plant catalogue', () => {
	it('contains the documented species with unique ids', () => {
		assert.deepEqual(
			PLANT_DEFINITIONS.map((definition) => definition.id),
			[...PLANT_IDS],
		);
	});

	it('gives every species a known rarity, glyph, label and positive weight', () => {
		for (const definition of PLANT_DEFINITIONS) {
			assert.ok(RARITY_ORDER.includes(definition.rarity), definition.id);
			assert.ok(GLYPHS.has(definition.glyph), definition.id);
			assert.ok(definition.name.length > 0, definition.id);
			assert.ok(definition.description.length > 0, definition.id);
			assert.ok(definition.conditionLabel.length > 0, definition.id);
			assert.ok(definition.weight > 0, definition.id);
		}
	});

	it('keeps at least one species per rarity', () => {
		for (const rarity of RARITY_ORDER) {
			assert.ok(getDefinitionsByRarity(rarity).length > 0, rarity);
		}
	});

	it('always keeps a fallback species eligible for any fix', () => {
		const plainCommit = featuresFrom({ subject: 'fix: a plain bug' });
		const eligible = getDefinitionsByRarity('common').filter((definition) => isEligible(definition, plainCommit));
		assert.ok(eligible.length > 0);
	});

	it('looks definitions up by id', () => {
		assert.equal(getPlantDefinition('sakura')?.name, 'Sakura');
		assert.equal(getPlantDefinition('nope'), undefined);
	});
});

describe('unlock conditions', () => {
	it('only unlocks Sakura when more lines are removed than added', () => {
		const sakura = getPlantDefinition('sakura');
		assert.ok(sakura);
		assert.equal(isEligible(sakura, featuresFrom({ additions: 1, deletions: 9 })), true);
		assert.equal(isEligible(sakura, featuresFrom({ additions: 9, deletions: 1 })), false);
		assert.equal(isEligible(sakura, featuresFrom({ additions: 4, deletions: 4 })), false);
	});

	it('only unlocks Mushroom during the night window', () => {
		const mushroom = getPlantDefinition('mushroom');
		assert.ok(mushroom);
		assert.equal(isEligible(mushroom, featuresFrom({ authorDate: '2026-10-05T02:00:00Z' })), true);
		assert.equal(isEligible(mushroom, featuresFrom({ authorDate: '2026-10-05T12:00:00Z' })), false);
	});

	it('only unlocks Ghost Orchid for a night fix with a large diff', () => {
		const orchid = getPlantDefinition('ghost-orchid');
		assert.ok(orchid);
		assert.equal(
			isEligible(orchid, featuresFrom({ authorDate: '2026-10-05T02:00:00Z', filesChanged: 9 })),
			true,
		);
		assert.equal(
			isEligible(orchid, featuresFrom({ authorDate: '2026-10-05T12:00:00Z', filesChanged: 9 })),
			false,
		);
		assert.equal(
			isEligible(orchid, featuresFrom({ authorDate: '2026-10-05T02:00:00Z', filesChanged: 1 })),
			false,
		);
	});

	it('requires both tests and a large diff for the Ancient Oak', () => {
		const oak = getPlantDefinition('ancient-oak');
		assert.ok(oak);
		const large = { additions: 300, deletions: 20, filesChanged: 6 };
		assert.equal(isEligible(oak, featuresFrom({ ...large, hasTests: true })), true);
		assert.equal(isEligible(oak, featuresFrom({ ...large, hasTests: false })), false);
		assert.equal(
			isEligible(oak, featuresFrom({ additions: 300, deletions: 20, filesChanged: 6, hasTests: true })),
			true,
		);
		assert.equal(
			isEligible(oak, featuresFrom({ additions: 20, deletions: 300, filesChanged: 6, hasTests: true })),
			false,
		);
	});
});