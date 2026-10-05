import type { PlantViewModel, GardenViewModel } from './gardenSerializer.ts';

export interface GardenUpdatedMessage {
	type: 'garden/updated';
	payload: GardenViewModel;
}

export interface PlantDiscoveredMessage {
	type: 'plant/discovered';
	payload: { plant: PlantViewModel; quip: string | null };
}

export type ExtensionToWebviewMessage = GardenUpdatedMessage | PlantDiscoveredMessage;

export interface GardenReadyMessage {
	type: 'garden/ready';
}

export interface PlantSelectMessage {
	type: 'plant/select';
	instanceId: string;
}

export interface ProjectSelectMessage {
	type: 'project/select';
	projectId: string;
}

export interface RefreshMessage {
	type: 'garden/refresh';
}

export type WebviewToExtensionMessage =
	| GardenReadyMessage
	| PlantSelectMessage
	| ProjectSelectMessage
	| RefreshMessage;

const INBOUND_TYPES = ['garden/ready', 'plant/select', 'project/select', 'garden/refresh'] as const;

/**
 * Validates anything the webview sends. The webview is the untrusted side of the boundary, so
 * unknown or malformed messages are rejected instead of cast.
 */
export function parseInboundMessage(data: unknown): WebviewToExtensionMessage | null {
	if (typeof data !== 'object' || data === null) {
		return null;
	}

	const candidate = data as { type?: unknown; instanceId?: unknown; projectId?: unknown };
	const type = candidate.type;
	if (typeof type !== 'string' || !INBOUND_TYPES.includes(type as (typeof INBOUND_TYPES)[number])) {
		return null;
	}

	switch (type) {
		case 'plant/select':
			return typeof candidate.instanceId === 'string' && candidate.instanceId.length > 0
				? { type: 'plant/select', instanceId: candidate.instanceId }
				: null;
		case 'project/select':
			return typeof candidate.projectId === 'string' && candidate.projectId.length > 0
				? { type: 'project/select', projectId: candidate.projectId }
				: null;
		case 'garden/ready':
			return { type: 'garden/ready' };
		case 'garden/refresh':
			return { type: 'garden/refresh' };
		default:
			return null;
	}
}