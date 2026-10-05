/**
 * Deterministic pseudo randomness. Everything that looks random in Bug Garden is seeded from
 * stable data (the commit SHA) so the same commit always produces the same plant.
 */

/** FNV-1a, 32 bit. Stable across platforms and Node versions. */
export function seedFromString(value: string): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

export interface SeededRandom {
	/** Uniform float in [0, 1). */
	next(): number;
	/** Uniform integer in [min, max], both inclusive. */
	int(min: number, max: number): number;
}

export function createSeededRandom(seed: string | number): SeededRandom {
	let state = (typeof seed === 'string' ? seedFromString(seed) : seed) >>> 0;

	const next = (): number => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};

	return {
		next,
		int: (min, max) => min + Math.floor(next() * (max - min + 1)),
	};
}

export interface WeightedOption<T> {
	value: T;
	weight: number;
}

/** Picks one option proportionally to its weight. Zero and negative weights are ignored. */
export function pickWeighted<T>(random: SeededRandom, options: readonly WeightedOption<T>[]): T {
	const total = options.reduce((sum, option) => sum + Math.max(option.weight, 0), 0);
	if (total <= 0) {
		throw new Error('pickWeighted requires at least one option with a positive weight');
	}

	let threshold = random.next() * total;
	for (const option of options) {
		threshold -= Math.max(option.weight, 0);
		if (threshold < 0) {
			return option.value;
		}
	}

	const last = options[options.length - 1];
	if (!last) {
		throw new Error('pickWeighted requires a non empty option list');
	}
	return last.value;
}