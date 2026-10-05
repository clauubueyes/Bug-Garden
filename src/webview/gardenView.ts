import * as vscode from 'vscode';
import { parseInboundMessage, type ExtensionToWebviewMessage } from './messages.ts';
import { createEmptyViewModel, serializeGarden, type ProjectOption } from './gardenSerializer.ts';
import type { GardenService } from '../garden/gardenService.ts';

export const VIEW_ID = 'bugGarden.gardenView';

export interface GardenViewDependencies {
	gardenService: GardenService;
	/** Project whose garden is currently displayed, or null when no folder is open. */
	getActiveProjectId: () => string | null;
	getProjects: () => ProjectOption[];
	onProjectSelected: (projectId: string) => void | Promise<void>;
	onRefreshRequested: () => void | Promise<void>;
}

/**
 * Renders the garden inside the Activity Bar. The extension side only sends plain snapshots and
 * understands a small message protocol, so the webview never reaches into VS Code or git.
 */
export class GardenViewProvider implements vscode.WebviewViewProvider {
	private view: vscode.WebviewView | undefined;
	private readonly subscriptions: vscode.Disposable[] = [];
	private readonly extensionUri: vscode.Uri;
	private readonly dependencies: GardenViewDependencies;

	constructor(extensionUri: vscode.Uri, dependencies: GardenViewDependencies) {
		this.extensionUri = extensionUri;
		this.dependencies = dependencies;
	}

	resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		view.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
		};
		view.webview.html = renderShell(view.webview, this.extensionUri);

		this.subscriptions.push(
			view.webview.onDidReceiveMessage((data: unknown) => {
				void this.handleMessage(data);
			}),
			view.onDidDispose(() => {
				this.view = undefined;
			}),
		);
	}

	async send(message: ExtensionToWebviewMessage): Promise<void> {
		await this.view?.webview.postMessage(message);
	}

	/** Pushes the current garden, or the empty state when no folder is open. */
	async sendActiveGarden(): Promise<void> {
		const projectId = this.dependencies.getActiveProjectId();
		const projects = this.dependencies.getProjects();
		const payload = projectId
			? serializeGarden(this.dependencies.gardenService.getGarden(projectId), projects)
			: createEmptyViewModel(projects);

		await this.send({ type: 'garden/updated', payload });
	}

	dispose(): void {
		for (const subscription of this.subscriptions) {
			subscription.dispose();
		}
	}

	private async handleMessage(data: unknown): Promise<void> {
		const message = parseInboundMessage(data);
		if (!message) {
			return;
		}

		switch (message.type) {
			case 'garden/ready':
				await this.sendActiveGarden();
				break;
			case 'garden/refresh':
				await this.dependencies.onRefreshRequested();
				break;
			case 'project/select':
				await this.dependencies.onProjectSelected(message.projectId);
				await this.sendActiveGarden();
				break;
			case 'plant/select':
				break;
		}
	}
}

/** Static shell. Every dynamic value is rendered by the webview script with DOM APIs. */
function renderShell(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const nonce = createNonce();
	const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'garden.css'));
	const glyphsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'glyphs.js'));
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'garden.js'));

	return `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<link href="${styleUri.toString()}" rel="stylesheet" />
		<title>Bug Garden</title>
	</head>
	<body>
		<main id="garden" class="garden"></main>
		<script nonce="${nonce}" src="${glyphsUri.toString()}"></script>
		<script nonce="${nonce}" src="${scriptUri.toString()}"></script>
	</body>
</html>`;
}

function createNonce(): string {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let nonce = '';
	for (let index = 0; index < 32; index += 1) {
		nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
	}
	return nonce;
}