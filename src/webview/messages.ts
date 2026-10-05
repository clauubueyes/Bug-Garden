import type { GardenViewModel } from './gardenSerializer.ts';

export interface GardenUpdatedMessage {
	type: 'garden/updated';
	payload: GardenViewModel;
}

/** The only message the extension sends in V1: the full garden snapshot. */
export type ExtensionToWebviewMessage = GardenUpdatedMessage;

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

export type WebviewToExtensionMessage = GardenReadyMessage | ProjectSelectMessage | RefreshMessage;

/**
 * Validates anything the webview sends. The webview is the untrusted side of the boundary, so
 * unknown or malformed messages are rejected instead of cast. Selecting a plant needs no round
 * trip: the webview renders the details it already has.
 */
export function parseInboundMessage(data: unknown): WebviewToExtensionMessage | null {
	if (typeof data !== 'object' || data === null) {
		return null;
	}

	const candidate = data as { type?: unknown; projectId?: unknown };
	switch (candidate.type) {
		case 'garden/ready':
			return { type: 'garden/ready' };
		case 'garden/refresh':
			return { type: 'garden/refresh' };
		case 'project/select':
			return typeof candidate.projectId === 'string' && candidate.projectId.length > 0
				? { type: 'project/select', projectId: candidate.projectId }
				: null;
		default:
			return null;
	}
}