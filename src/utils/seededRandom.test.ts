import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSeededRandom, pickWeighted, seedFromString } from './seededRandom.ts';

describe('seedFromString', () => {
	it('is stable for the same input', () => {
		assert.equal(seedFromString('abc123'), seedFromString('abc123'));
	});

	it('separates different inputs', () => {
		assert.notEqual(seedFromString('abc123'), seedFromString('abc124'));
	});

	it('returns an unsigned 32 bit integer', () => {
		for (const input of ['', 'a', 'fix: repair timestamp drift', 'zzzzzzzzzzzzzzz']) {
			const seed = seedFromString(input);
			assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, input);
		}
	});
});

describe('createSeededRandom', () => {
	it('produces the same sequence for the same seed', () => {
		const a = createSeededRandom('commit-sha');
		const b = createSeededRandom('commit-sha');
		const first = [a.next(), a.next(), a.next()];
		const second = [b.next(), b.next(), b.next()];
		assert.deepEqual(first, second);
	});

	it('produces a different sequence for a different seed', () => {
		const a = createSeededRandom('commit-a');
		const b = createSeededRandom('commit-b');
		assert.notEqual(a.next(), b.next());
	});

	it('stays inside [0, 1)', () => {
		const random = createSeededRandom(42);
		for (let index = 0; index < 500; index += 1) {
			const value = random.next();
			assert.ok(value >= 0 && value < 1, `unexpected value ${value}`);
		}
	});

	it('int() includes both bounds', () => {
		const random = createSeededRandom('ints');
		const seen = new Set<number>();
		for (let index = 0; index < 300; index += 1) {
			seen.add(random.int(1, 3));
		}
		assert.deepEqual([...seen].sort(), [1, 2, 3]);
	});
});

describe('pickWeighted', () => {
	it('never picks an option with zero weight', () => {
		const random = createSeededRandom('weights');
		for (let index = 0; index < 200; index += 1) {
			const picked = pickWeighted(random, [
				{ value: 'a', weight: 0 },
				{ value: 'b', weight: 5 },
			]);
			assert.equal(picked, 'b');
		}
	});

	it('respects the weight distribution', () => {
		const random = createSeededRandom('distribution');
		const counts: Record<'heavy' | 'light', number> = { heavy: 0, light: 0 };
		const iterations = 2000;
		for (let index = 0; index < iterations; index += 1) {
			const picked = pickWeighted<'heavy' | 'light'>(random, [
				{ value: 'heavy', weight: 9 },
				{ value: 'light', weight: 1 },
			]);
			counts[picked] += 1;
		}
		assert.ok(counts.heavy > counts.light * 4, JSON.stringify(counts));
		assert.equal(counts.heavy + counts.light, iterations);
	});

	it('fails loudly when no option can be picked', () => {
		const random = createSeededRandom('empty');
		assert.throws(() => pickWeighted(random, [{ value: 'a', weight: 0 }]), /positive weight/);
	});
});