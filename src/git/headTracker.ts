/**
 * Watches the HEAD sha of one repository. It holds no timers and no VS Code types: the
 * caller decides when to check, which makes the "did HEAD move?" logic trivial to test.
 */
export class HeadTracker {
	private lastSha: string | null = null;
	private readonly readSha: () => Promise<string | null>;
	private readonly onChanged: (sha: string) => void;

	constructor(readSha: () => Promise<string | null>, onChanged: (sha: string) => void) {
		this.readSha = readSha;
		this.onChanged = onChanged;
	}

	/** Returns true when HEAD points somewhere new. The first call only records a baseline. */
	async check(): Promise<boolean> {
		const sha = await this.readSha();
		if (sha === null) {
			return false;
		}
		if (this.lastSha === null) {
			this.lastSha = sha;
			return false;
		}
		if (this.lastSha === sha) {
			return false;
		}

		this.lastSha = sha;
		this.onChanged(sha);
		return true;
	}

	get baseline(): string | null {
		return this.lastSha;
	}
}