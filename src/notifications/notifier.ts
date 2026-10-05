import * as vscode from 'vscode';
import { newlyUnlocked, type AchievementView } from '../garden/achievements.ts';
import type { PlantInstance } from '../types/plant.ts';

export interface Notifier {
	plantGrew(plant: PlantInstance): void;
	achievementsUnlocked(achievements: readonly AchievementView[]): void;
	error(message: string): void;
}

/**
 * The only place that talks to the user's attention. Everything is best effort: a notification
 * that fails must never break a scan, and achievements are announced in one message so a big
 * scan does not spam a dozen toasts.
 */
export function createNotifier(output: vscode.OutputChannel): Notifier {
	return {
		plantGrew: (plant) => {
			void vscode.window.setStatusBarMessage(
				`Bug Garden: ${plant.name} grew from "${plant.commitSubject}"`,
				5_000,
			);
		},

		achievementsUnlocked: (achievements) => {
			if (achievements.length === 0) {
				return;
			}

			output.appendLine(`[achievements] ${achievements.map((achievement) => achievement.id).join(', ')}`);
			const message =
				achievements.length === 1
					? `${achievements[0]?.name} unlocked: ${achievements[0]?.description}`
					: `${achievements.length} achievements unlocked`;
			void vscode.window.showInformationMessage(message);
		},

		error: (message) => {
			output.appendLine(`[error] ${message}`);
			void vscode.window.showErrorMessage(`Bug Garden: ${message}`);
		},
	};
}

/** Convenience wrapper so the extension can hand over the whole result of a scan. */
export function announceScan(
	notifier: Notifier,
	added: readonly PlantInstance[],
	unlocked: readonly AchievementView[],
): void {
	for (const plant of added) {
		notifier.plantGrew(plant);
	}
	notifier.achievementsUnlocked(unlocked);
}

export { newlyUnlocked };