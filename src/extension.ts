import * as vscode from 'vscode';
import { createHistoryReader } from './git/historyReader.ts';
import { createGardenService } from './garden/gardenService.ts';
import { createStorageService } from './storage/storageService.ts';
import { findRepositoryRoot, readHeadSha } from './git/gitCli.ts';
import { HeadTracker } from './git/headTracker.ts';
import { watchWorkspaceHead } from './git/commitWatcher.ts';
import { createProjectId, createProjectName } from './storage/projectKey.ts';
import { GardenViewProvider, VIEW_ID } from './webview/gardenView.ts';
import type { ProjectOption } from './webview/gardenSerializer.ts';

export function activate(context: vscode.ExtensionContext): void {
	const output = vscode.window.createOutputChannel('Bug Garden');
	context.subscriptions.push(output);

	const storage = createStorageService(context.workspaceState, {
		onWarning: (message) => output.appendLine(`[storage] ${message}`),
	});

	const repositoryRoots = new Map<string, string>();
	const gardenService = createGardenService({
		historyReader: createHistoryReader(),
		storage,
		isRepository: (workspacePath) => repositoryRoots.has(createProjectId(workspacePath)),
	});

	let activeProjectId = firstProjectId();

	const viewProvider: GardenViewProvider = new GardenViewProvider(context.extensionUri, {
		gardenService,
		getActiveProjectId: () => activeProjectId,
		getProjects: () => listProjects(),
		onProjectSelected: (projectId) => {
			activeProjectId = projectId;
		},
		onRefreshRequested: () => scanAll().then(() => viewProvider.sendActiveGarden()),
	});
	context.subscriptions.push(viewProvider, vscode.window.registerWebviewViewProvider(VIEW_ID, viewProvider));

	context.subscriptions.push(
		vscode.commands.registerCommand('bugGarden.showGarden', async () => {
			await vscode.commands.executeCommand(`${VIEW_ID}.focus`);
		}),
		vscode.commands.registerCommand('bugGarden.refreshGarden', async () => {
			await scanAll();
			await viewProvider.sendActiveGarden();
			output.appendLine('Garden refreshed.');
		}),
	);

	void activateWorkspaces(context, repositoryRoots, () => {
		void scanAll().then(() => viewProvider.sendActiveGarden());
	});

	async function scanAll(): Promise<void> {
		for (const folder of vscode.workspace.workspaceFolders ?? []) {
			await scanFolder(folder);
		}
	}

	async function scanFolder(folder: vscode.WorkspaceFolder): Promise<void> {
		const root = repositoryRoots.get(createProjectId(folder.uri.fsPath));
		if (!root) {
			return;
		}

		try {
			const result = await gardenService.scan(folder.uri.fsPath);
			output.appendLine(
				`${folder.name}: scanned ${result.scanned} commits, ${result.added.length} new plants`,
			);
		} catch (error) {
			output.appendLine(`[error] ${folder.name}: ${describe(error)}`);
		}
	}

	function listProjects(): ProjectOption[] {
		return (vscode.workspace.workspaceFolders ?? []).map((folder) => ({
			projectId: createProjectId(folder.uri.fsPath),
			projectName: createProjectName(folder.uri.fsPath),
		}));
	}

	function firstProjectId(): string | null {
		const first = vscode.workspace.workspaceFolders?.[0];
		return first ? createProjectId(first.uri.fsPath) : null;
	}
}

async function activateWorkspaces(
	context: vscode.ExtensionContext,
	repositoryRoots: Map<string, string>,
	onChange: () => void,
): Promise<void> {
	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		await registerWorkspace(context, folder, repositoryRoots, onChange);
	}

	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders((event) => {
			for (const removed of event.removed) {
				repositoryRoots.delete(createProjectId(removed.uri.fsPath));
			}
			for (const added of event.added) {
				void registerWorkspace(context, added, repositoryRoots, onChange);
			}
		}),
	);
}

async function registerWorkspace(
	context: vscode.ExtensionContext,
	folder: vscode.WorkspaceFolder,
	repositoryRoots: Map<string, string>,
	onChange: () => void,
): Promise<void> {
	const projectId = createProjectId(folder.uri.fsPath);
	const root = await findRepositoryRoot(folder.uri.fsPath);
	repositoryRoots.set(projectId, root ?? '');
	if (!root) {
		return;
	}

	const tracker = new HeadTracker(() => readHeadSha(root), () => onChange());
	context.subscriptions.push(watchWorkspaceHead(folder, () => void tracker.check()));
	void tracker.check();
	onChange();
}

export function deactivate(): void {}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}