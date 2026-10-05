import type { CommitFeatures } from './commit.ts';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY_ORDER: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export const RARITY_LABELS: Readonly<Record<Rarity, string>> = {
	common: 'Common',
	rare: 'Rare',
	epic: 'Epic',
	legendary: 'Legendary',
};

export type PlantGlyph =
	| 'sprout'
	| 'tulip'
	| 'sunflower'
	| 'fern'
	| 'cactus'
	| 'mushroom'
	| 'lotus'
	| 'monstera'
	| 'orchid'
	| 'oak'
	| 'sakura';

/** A plant species as authored in the catalogue. Conditions are code, not data, because
 * they combine several commit features; the catalogue is the single source of truth. */
export interface PlantDefinition {
	id: string;
	name: string;
	rarity: Rarity;
	description: string;
	glyph: PlantGlyph;
	/** Hard requirement. When omitted the species is eligible for any bug fix. */
	unlockCondition?: (features: CommitFeatures) => boolean;
	/** Human readable reason shown in the plant details panel. */
	conditionLabel: string;
	/** Relative probability inside the eligible pool of the same rarity. */
	weight: number;
}

/** A plant that was actually granted to a garden, derived from exactly one commit. */
export interface PlantInstance {
	instanceId: string;
	speciesId: string;
	name: string;
	rarity: Rarity;
	description: string;
	glyph: PlantGlyph;
	conditionLabel: string;
	rarityReasons: readonly string[];
	rarityScore: number;
	commitSha: string;
	commitSubject: string;
	obtainedAt: string;
	projectId: string;
}