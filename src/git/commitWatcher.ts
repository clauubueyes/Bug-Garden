import * as vscode from 'vscode';

export const DEBOUNCE_MS = 1_000;

/**
 * Watches `.git/HEAD` for a workspace folder and calls `onHeadMoved` once things settle. Git
 * rewrites HEAD on commit, checkout and rebase, and a burst of writes is common, so events
 * are debounced before anything expensive happens.
 */
export function watchWorkspaceHead(
	workspaceFolder: vscode.WorkspaceFolder,
	onHeadMoved: () => void,
	debounceMs: number = DEBOUNCE_MS,
): vscode.Disposable {
	const pattern = new vscode.RelativePattern(workspaceFolder, '.git/HEAD');
	const watcher = vscode.workspace.createFileSystemWatcher(pattern);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const notify = (): void => {
		if (timer) {
			clearTimeout(timer);
		}
		timer = setTimeout(() => {
			timer = undefined;
			onHeadMoved();
		}, debounceMs);
	};

	watcher.onDidChange(notify);
	watcher.onDidCreate(notify);

	return new vscode.Disposable(() => {
		if (timer) {
			clearTimeout(timer);
		}
		watcher.dispose();
	});
}