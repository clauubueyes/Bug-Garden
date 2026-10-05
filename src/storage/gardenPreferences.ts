import type { MementoLike } from './storageService.ts';

export const PREFERENCES_KEY = 'bugGarden.preferences.v1';
export const MAX_LAYOUT_SLOTS = 4096;

export interface GardenPreferences {
	atmosphere: 'day' | 'night';
	slots: (string | null)[];
}

export interface GardenPreferencesStore {
	get(projectId: string): GardenPreferences;
	save(projectId: string, preferences: GardenPreferences): Promise<void>;
}

export function parseGardenPreferences(value: unknown): GardenPreferences | null {
	if (typeof value !== 'object' || value === null) {
		return null;
	}
	const candidate = value as { atmosphere?: unknown; slots?: unknown };
	if ((candidate.atmosphere !== 'day' && candidate.atmosphere !== 'night') || !Array.isArray(candidate.slots)) {
		return null;
	}
	if (candidate.slots.length > MAX_LAYOUT_SLOTS || !candidate.slots.every((slot: unknown) =>
		slot === null || (typeof slot === 'string' && slot.length > 0 && slot.length <= 256),
	)) {
		return null;
	}
	const seen = new Set<string>();
	const slots = (candidate.slots as (string | null)[]).map((slot) => {
		if (slot === null || seen.has(slot)) {
			return null;
		}
		seen.add(slot);
		return slot;
	});
	return { atmosphere: candidate.atmosphere, slots };
}

/** Layout and scenery live separately from earned plants and progression. */
export function createGardenPreferencesStore(memento: MementoLike): GardenPreferencesStore {
	let pending = Promise.resolve();
	const read = (): Record<string, unknown> => {
		const value = memento.get<unknown>(PREFERENCES_KEY);
		return typeof value === 'object' && value !== null && !Array.isArray(value)
			? value as Record<string, unknown>
			: {};
	};
	return {
		get: (projectId) => {
			const store = read();
			return (Object.hasOwn(store, projectId) ? parseGardenPreferences(store[projectId]) : null)
				?? { atmosphere: 'day', slots: [] };
		},
		save: (projectId, preferences) => {
			const value = parseGardenPreferences(preferences);
			if (!value) {
				return Promise.reject(new Error('Invalid garden preferences'));
			}
			pending = pending.catch(() => undefined).then(async () => {
				await memento.update(PREFERENCES_KEY, { ...read(), [projectId]: value });
			});
			return pending;
		},
	};
}
