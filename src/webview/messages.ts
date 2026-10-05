import type { GardenViewModel } from './gardenSerializer.ts';
import { parseGardenPreferences, type GardenPreferences } from '../storage/gardenPreferences.ts';

export interface GardenUpdatedMessage {
	type: 'garden/updated';
	payload: GardenViewModel;
	preferences: GardenPreferences;
}

/** Garden snapshots and feedback from extension actions. */
export type ExtensionToWebviewMessage = GardenUpdatedMessage | {
	type: 'garden/notice';
	message: string;
};

export interface GardenReadyMessage {
	type: 'garden/ready';
}

export interface ProjectSelectMessage {
	type: 'project/select';
	projectId: string;
}

export interface RefreshMessage {
	type: 'garden/refresh';
}

export type WebviewToExtensionMessage = GardenReadyMessage | ProjectSelectMessage | RefreshMessage
	| { type: 'garden/expand' }
	| { type: 'garden/openFolder' }
	| { type: 'garden/preferences'; projectId: string; preferences: GardenPreferences }
	| { type: 'plant/copyCommit'; projectId: string; instanceId: string };

/**
 * Validates anything the webview sends. The webview is the untrusted side of the boundary, so
 * unknown or malformed messages are rejected instead of cast. Selecting a plant needs no round
 * trip: the webview renders the details it already has.
 */
export function parseInboundMessage(data: unknown): WebviewToExtensionMessage | null {
	if (typeof data !== 'object' || data === null) {
		return null;
	}

	const candidate = data as { type?: unknown; projectId?: unknown; preferences?: unknown; instanceId?: unknown };
	switch (candidate.type) {
		case 'garden/ready':
			return { type: 'garden/ready' };
		case 'garden/refresh':
			return { type: 'garden/refresh' };
		case 'garden/expand':
			return { type: 'garden/expand' };
		case 'garden/openFolder':
			return { type: 'garden/openFolder' };
		case 'garden/preferences': {
			const preferences = parseGardenPreferences(candidate.preferences);
			return typeof candidate.projectId === 'string' && candidate.projectId.length > 0 && preferences
				? { type: 'garden/preferences', projectId: candidate.projectId, preferences }
				: null;
		}
		case 'plant/copyCommit':
			return typeof candidate.projectId === 'string' && candidate.projectId.length > 0
				&& typeof candidate.instanceId === 'string' && candidate.instanceId.length > 0
				? { type: 'plant/copyCommit', projectId: candidate.projectId, instanceId: candidate.instanceId }
				: null;
		case 'project/select':
			return typeof candidate.projectId === 'string' && candidate.projectId.length > 0
				? { type: 'project/select', projectId: candidate.projectId }
				: null;
		default:
			return null;
	}
}
