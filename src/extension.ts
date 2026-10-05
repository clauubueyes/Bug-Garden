import * as vscode from 'vscode';

export function activate(_context: vscode.ExtensionContext): void {
	void vscode.window.showInformationMessage('Bug Garden is warming up its greenhouse.');
}

export function deactivate(): void {}