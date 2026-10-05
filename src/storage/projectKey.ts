import { basename, resolve } from 'node:path';

/**
 * A garden is identified by the workspace folder it belongs to. The id has to survive
 * serialisation and avoid case-only differences on Windows and macOS, so paths are
 * normalised before they become keys.
 */
export function createProjectId(workspacePath: string): string {
	const normalised = resolve(workspacePath).replaceAll(/[\\/]+/g, '/').replace(/\/$/, '');
	return process.platform === 'win32' || process.platform === 'darwin' ? normalised.toLowerCase() : normalised;
}

export function createProjectName(workspacePath: string): string {
	return basename(resolve(workspacePath)) || workspacePath;
}