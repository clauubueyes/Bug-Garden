import * as vscode from 'vscode';
import { parseInboundMessage, type ExtensionToWebviewMessage } from './messages.ts';
import { serializeActiveGarden, type ProjectOption } from './gardenSerializer.ts';
import type { GardenService } from '../garden/gardenService.ts';
import type { GardenPreferencesStore } from '../storage/gardenPreferences.ts';

export const VIEW_ID = 'bugGarden.gardenView';

export interface GardenViewDependencies {
	gardenService: GardenService;
	preferences: GardenPreferencesStore;
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
	private panel: vscode.WebviewPanel | undefined;
	private readonly subscriptions: vscode.Disposable[] = [];
	private readonly extensionUri: vscode.Uri;
	private readonly dependencies: GardenViewDependencies;

	constructor(extensionUri: vscode.Uri, dependencies: GardenViewDependencies) {
		this.extensionUri = extensionUri;
		this.dependencies = dependencies;
	}

	resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		this.subscriptions.push(
			view.onDidDispose(() => {
				this.view = undefined;
			}),
			view.onDidChangeVisibility(() => {
				if (view.visible) {
					void this.sendActiveGarden();
				}
			}),
		);
		this.configureWebview(view.webview);
	}

	openPanel(): void {
		if (this.panel) {
			this.panel.reveal();
			return;
		}
		this.panel = vscode.window.createWebviewPanel('bugGarden.fullGarden', 'Bug Garden', vscode.ViewColumn.One, {});
		this.subscriptions.push(this.panel.onDidDispose(() => { this.panel = undefined; }));
		this.configureWebview(this.panel.webview);
	}

	private configureWebview(webview: vscode.Webview): void {
		webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
		};
		this.subscriptions.push(webview.onDidReceiveMessage((data: unknown) => {
			void this.handleMessage(data).catch(() => this.send({
				type: 'garden/notice', message: 'Could not complete that action. Please try again.',
			}));
		}));
		webview.html = renderShell(webview, this.extensionUri);
	}

	async send(message: ExtensionToWebviewMessage): Promise<void> {
		await Promise.all([this.view?.webview.postMessage(message), this.panel?.webview.postMessage(message)]);
	}

	/** Pushes the current garden, or the empty state when no folder is open. */
	async sendActiveGarden(): Promise<void> {
		const projectId = this.dependencies.getActiveProjectId();
		const projects = this.dependencies.getProjects();
		const payload = serializeActiveGarden(this.dependencies.gardenService, projectId, projects);

		const preferences = this.dependencies.preferences.get(payload.projectId ?? '');
		await this.send({ type: 'garden/updated', payload, preferences });
	}

	dispose(): void {
		this.panel?.dispose();
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
			case 'garden/expand':
				this.openPanel();
				break;
			case 'garden/openFolder':
				await vscode.commands.executeCommand('workbench.action.files.openFolder');
				break;
			case 'garden/preferences': {
				if (!this.dependencies.getProjects().some((project) => project.projectId === message.projectId)) {
					break;
				}
				const ids = new Set(this.dependencies.gardenService.getGarden(message.projectId).plants.map((plant) => plant.instanceId));
				await this.dependencies.preferences.save(message.projectId, {
					atmosphere: message.preferences.atmosphere,
					slots: message.preferences.slots.map((id) => id !== null && ids.has(id) ? id : null),
				});
				await this.sendActiveGarden();
				break;
			}
			case 'plant/copyCommit': {
				if (!this.dependencies.getProjects().some((project) => project.projectId === message.projectId)) {
					break;
				}
				const plant = this.dependencies.gardenService.getGarden(message.projectId).plants.find((entry) => entry.instanceId === message.instanceId);
				if (plant) {
					await vscode.env.clipboard.writeText(plant.commitSha);
					await this.send({ type: 'garden/notice', message: 'Commit hash copied.' });
				}
				break;
			}
			case 'project/select':
				if (!this.dependencies.getProjects().some((project) => project.projectId === message.projectId)) {
					break;
				}
				await this.dependencies.onProjectSelected(message.projectId);
				await this.sendActiveGarden();
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
