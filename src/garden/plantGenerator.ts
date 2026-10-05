import { extractFeatures } from './commitFeatures.ts';
import { PLANT_DEFINITIONS, isEligible } from './plantDefinitions.ts';
import { calculateRarity } from './rarityCalculator.ts';
import { createSeededRandom, pickWeighted } from '../utils/seededRandom.ts';
import { RARITY_ORDER, type PlantDefinition, type PlantInstance, type Rarity } from '../types/plant.ts';
import type { CommitFeatures, CommitInfo } from '../types/commit.ts';

export interface GeneratePlantOptions {
	projectId: string;
}

/**
 * Turns one bug-fix commit into one plant. Pure and deterministic: the same commit always
 * yields the same plant, so re-scanning history never reshuffles the garden.
 */
export function generatePlant(commit: CommitInfo, projectId: string): PlantInstance {
	const features = extractFeatures(commit);
	const { rarity, score, reasons } = calculateRarity(features);
	const definition = selectDefinition(rarity, features, commit.sha);

	return {
		instanceId: `${definition.id}:${commit.sha}`,
		speciesId: definition.id,
		name: definition.name,
		rarity: definition.rarity,
		description: definition.description,
		glyph: definition.glyph,
		conditionLabel: definition.conditionLabel,
		rarityReasons: reasons,
		rarityScore: score,
		commitSha: commit.sha,
		commitSubject: commit.subject,
		obtainedAt: commit.authorDate,
		projectId,
	};
}

/**
 * Picks a species for the computed rarity. Species whose unlock condition does not hold are
 * skipped; if a tier ends up empty we step down until something is eligible, which keeps
 * every fix producing a plant instead of silently growing nothing.
 */
function selectDefinition(rarity: Rarity, features: CommitFeatures, seed: string): PlantDefinition {
	for (const tier of tiersFrom(rarity)) {
		const eligible = PLANT_DEFINITIONS.filter(
			(definition) => definition.rarity === tier && isEligible(definition, features),
		);
		if (eligible.length > 0) {
			return pickWeighted(
				createSeededRandom(`${seed}:species:${tier}`),
				eligible.map((definition) => ({ value: definition, weight: definition.weight })),
			);
		}
	}

	throw new Error('No eligible plant definition found; check the plant catalogue');
}

function tiersFrom(rarity: Rarity): readonly Rarity[] {
	const start = Math.max(RARITY_ORDER.indexOf(rarity), 0);
	return RARITY_ORDER.slice(0, start + 1).reverse();
}