import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('toolchain', () => {
	it('runs TypeScript sources without a build step', () => {
		const sum = (a: number, b: number): number => a + b;
		assert.equal(sum(2, 2), 4);
	});
});