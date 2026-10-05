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
import { announceScan, createNotifier } from './notifications/notifier.ts';

export function activate(context: vscode.ExtensionContext): void {
	const output = vscode.window.createOutputChannel('Bug Garden');
	context.subscriptions.push(output);
	const notifier = createNotifier(output);

	const storage = createStorageService(context.workspaceState, {
		onWarning: (message) => output.appendLine(`[storage] ${message}`),
	});

	/** Repositories already resolved, so scanning never pays for `git rev-parse` again. */
	const repositoryRoots = new Map<string, string>();
	let scanning: Promise<void> | undefined;

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
		onRefreshRequested: async () => {
			await refresh();
		},
	});
	context.subscriptions.push(viewProvider, vscode.window.registerWebviewViewProvider(VIEW_ID, viewProvider));

	context.subscriptions.push(
		vscode.commands.registerCommand('bugGarden.showGarden', async () => {
			await vscode.commands.executeCommand(`${VIEW_ID}.focus`);
		}),
		vscode.commands.registerCommand('bugGarden.refreshGarden', async () => {
			await refresh();
			output.appendLine('Garden refreshed.');
		}),
	);

	// A new folder becomes the active project so a single root workspace is never left empty.
	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders((event) => {
			const added = event.added[0];
			if (added) {
				activeProjectId = createProjectId(added.uri.fsPath);
			}
			void refresh();
		}),
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			const projectId = projectIdForUri(editor?.document.uri);
			if (projectId) {
				activeProjectId = projectId;
				void viewProvider.sendActiveGarden();
			}
		}),
	);

	void activateWorkspaces(context, repositoryRoots, () => {
		void refresh();
	});

	/** Serialised so overlapping HEAD moves cannot start two scans at once. */
	async function refresh(): Promise<void> {
		if (scanning) {
			await scanning;
		}
		scanning = scanAndRender();
		try {
			await scanning;
		} finally {
			scanning = undefined;
		}
	}

	async function scanAndRender(): Promise<void> {
		for (const folder of vscode.workspace.workspaceFolders ?? []) {
			await scanFolder(folder);
		}
		await viewProvider.sendActiveGarden();
	}

	async function scanFolder(folder: vscode.WorkspaceFolder): Promise<void> {
		const root = repositoryRoots.get(createProjectId(folder.uri.fsPath));
		if (!root) {
			return;
		}

		try {
			const result = await gardenService.scan(folder.uri.fsPath);
			output.appendLine(
				`${folder.name}: scanned ${result.scanned} commits, ${result.added.length} new plants, level ${result.stats.gardenLevel}`,
			);
			announceScan(notifier, result.added, result.newlyUnlocked);
		} catch (error) {
			notifier.error(`${folder.name}: ${describe(error)}`);
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
}

/**
 * A workspace folder only gets a watcher once it is known to be a repository, so a folder that
 * is not under git is never scanned and `.git/HEAD` is never watched for nothing.
 */
async function registerWorkspace(
	context: vscode.ExtensionContext,
	folder: vscode.WorkspaceFolder,
	repositoryRoots: Map<string, string>,
	onChange: () => void,
): Promise<void> {
	const projectId = createProjectId(folder.uri.fsPath);
	const root = await findRepositoryRoot(folder.uri.fsPath);
	if (!root) {
		repositoryRoots.delete(projectId);
		return;
	}

	repositoryRoots.set(projectId, root);
	const tracker = new HeadTracker(() => readHeadSha(root), () => onChange());
	context.subscriptions.push(watchWorkspaceHead(folder, () => void tracker.check()));
	void tracker.check();
	onChange();
}

/** Resolves which workspace folder a uri belongs to, so the view follows the active editor. */
function projectIdForUri(uri: vscode.Uri | undefined): string | null {
	if (!uri) {
		return null;
	}

	const path = uri.fsPath;
	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		if (path === folder.uri.fsPath || path.startsWith(`${folder.uri.fsPath}/`) || path.startsWith(`${folder.uri.fsPath}\\`)) {
			return createProjectId(folder.uri.fsPath);
		}
	}
	return null;
}

export function deactivate(): void {}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}