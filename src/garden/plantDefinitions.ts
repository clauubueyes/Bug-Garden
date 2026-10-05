import { conditions } from './conditions.ts';
import type { CommitFeatures } from '../types/commit.ts';
import type { PlantDefinition, Rarity } from '../types/plant.ts';

/**
 * The plant catalogue. This is the only place where unlock conditions live; the generator
 * reads from here and nowhere else. Adding a plant means adding an entry plus its test.
 */
export const PLANT_DEFINITIONS: readonly PlantDefinition[] = [
	{
		id: 'sprout',
		name: 'Sprout',
		rarity: 'common',
		description: 'The first thing that shows up when you finally admit something was broken.',
		glyph: 'sprout',
		conditionLabel: 'Any bug fix will do',
		weight: 3,
	},
	{
		id: 'tulip',
		name: 'Tulip',
		rarity: 'common',
		description: 'Cheap, cheerful, and out every single day.',
		glyph: 'tulip',
		unlockCondition: conditions.isSmallDiff,
		conditionLabel: 'A small, contained fix',
		weight: 3,
	},
	{
		id: 'sunflower',
		name: 'Sunflower',
		rarity: 'common',
		description: 'Grown next to the tests. Keep doing that.',
		glyph: 'sunflower',
		unlockCondition: conditions.hasTests,
		conditionLabel: 'The fix came with tests',
		weight: 4,
	},
	{
		id: 'fern',
		name: 'Fern',
		rarity: 'common',
		description: 'Prefers a diff with real ambition behind it.',
		glyph: 'fern',
		unlockCondition: conditions.addsMoreThanRemoves,
		conditionLabel: 'More added than removed',
		weight: 2,
	},
	{
		id: 'cactus',
		name: 'Cactus',
		rarity: 'rare',
		description: 'Hard to kill, thanks to the tests that came with it.',
		glyph: 'cactus',
		unlockCondition: conditions.all(conditions.hasTests, conditions.isSmallDiff),
		conditionLabel: 'Small fix backed by tests',
		weight: 3,
	},
	{
		id: 'mushroom',
		name: 'Mushroom',
		rarity: 'rare',
		description: 'Blooms somewhere between midnight and four in the morning.',
		glyph: 'mushroom',
		unlockCondition: conditions.isNightFix,
		conditionLabel: 'Committed between 00:00 and 04:00 UTC',
		weight: 3,
	},
	{
		id: 'lotus',
		name: 'Lotus',
		rarity: 'rare',
		description: 'Blooms where a big diff crosses a test suite.',
		glyph: 'lotus',
		unlockCondition: conditions.all(conditions.isLargeDiff, conditions.hasTests),
		conditionLabel: 'Large fix with tests',
		weight: 2,
	},
	{
		id: 'monstera',
		name: 'Monstera',
		rarity: 'epic',
		description: 'One leaf per file touched. It spreads.',
		glyph: 'monstera',
		unlockCondition: conditions.touchesManyFiles,
		conditionLabel: 'Eight files or more in one fix',
		weight: 1,
	},
	{
		id: 'ghost-orchid',
		name: 'Ghost Orchid',
		rarity: 'epic',
		description: 'Blooms once a year, apparently in a timezone nobody uses.',
		glyph: 'orchid',
		unlockCondition: conditions.all(conditions.isNightFix, conditions.isLargeDiff),
		conditionLabel: 'Night fix across many files',
		weight: 1,
	},
	{
		id: 'ancient-oak',
		name: 'Ancient Oak',
		rarity: 'legendary',
		description: 'Enormous, well tested, and older than the sprint it grew in.',
		glyph: 'oak',
		unlockCondition: conditions.all(
			conditions.isLargeDiff,
			conditions.hasTests,
			conditions.addsMoreThanRemoves,
		),
		conditionLabel: 'Large, test covered addition',
		weight: 1,
	},
	{
		id: 'sakura',
		name: 'Sakura',
		rarity: 'legendary',
		description: 'Blooms when code is removed faster than it grows.',
		glyph: 'sakura',
		unlockCondition: conditions.netRemovals,
		conditionLabel: 'More lines removed than added',
		weight: 1,
	},
];

export function getPlantDefinition(plantId: string): PlantDefinition | undefined {
	return PLANT_DEFINITIONS.find((definition) => definition.id === plantId);
}

export function getDefinitionsByRarity(rarity: Rarity): readonly PlantDefinition[] {
	return PLANT_DEFINITIONS.filter((definition) => definition.rarity === rarity);
}

export function isEligible(definition: PlantDefinition, features: CommitFeatures): boolean {
	return definition.unlockCondition ? definition.unlockCondition(features) : true;
}