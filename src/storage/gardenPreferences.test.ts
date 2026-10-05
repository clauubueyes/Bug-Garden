import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGardenPreferencesStore, MAX_LAYOUT_SLOTS, parseGardenPreferences, PREFERENCES_KEY } from './gardenPreferences.ts';
import type { MementoLike } from './storageService.ts';

describe('garden preferences', () => {
	it('preserves empty plots and removes duplicate specimens', () => {
		assert.deepEqual(parseGardenPreferences({ atmosphere: 'night', slots: ['a', null, 'a', 'b'] }), {
			atmosphere: 'night', slots: ['a', null, null, 'b'],
		});
	});

	it('rejects malformed and oversized layouts', () => {
		for (const value of [null, {}, { atmosphere: 'rain', slots: [] }, { atmosphere: 'day', slots: [1] },
			{ atmosphere: 'day', slots: [''] }, { atmosphere: 'day', slots: Array(MAX_LAYOUT_SLOTS + 1).fill(null) }]) {
			assert.equal(parseGardenPreferences(value), null);
		}
	});

	it('keeps customization for separate projects across sessions', async () => {
		const data = new Map<string, unknown>();
		const memento: MementoLike = {
			get: <T>(key: string) => data.get(key) as T | undefined,
			update: (key, value) => { data.set(key, value); return Promise.resolve(); },
		};
		const store = createGardenPreferencesStore(memento);
		assert.deepEqual(store.get('p'), { atmosphere: 'day', slots: [] });
		await Promise.all([
			store.save('p', { atmosphere: 'night', slots: ['a', null] }),
			store.save('other', { atmosphere: 'day', slots: ['b'] }),
		]);
		const restored = createGardenPreferencesStore(memento);
		assert.deepEqual(restored.get('p'), { atmosphere: 'night', slots: ['a', null] });
		assert.deepEqual(restored.get('other'), { atmosphere: 'day', slots: ['b'] });
	});

	it('recovers from corrupted preferences without changing garden storage', () => {
		const memento: MementoLike = {
			get: <T>(key: string) => (key === PREFERENCES_KEY ? { p: { atmosphere: 'invalid' } } : undefined) as T | undefined,
			update: () => assert.fail('reading preferences must not write anything'),
		};
		assert.deepEqual(createGardenPreferencesStore(memento).get('p'), { atmosphere: 'day', slots: [] });
	});
});
