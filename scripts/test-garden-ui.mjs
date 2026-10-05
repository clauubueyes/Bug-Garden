/** Real Chromium integration checks using CDP; no browser-library dependency. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { basename, join, resolve, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createGardenService } from '../src/garden/gardenService.ts';
import { createHistoryReader } from '../src/git/historyReader.ts';
import { createStorageService } from '../src/storage/storageService.ts';
import { serializeGarden, createEmptyViewModel } from '../src/webview/gardenSerializer.ts';

const workspace = fileURLToPath(new URL('..', import.meta.url));
const artifacts = join(workspace, '.vscode-test');
mkdirSync(artifacts, { recursive: true });
const data = new Map();
const storage = createStorageService({ get: (key) => data.get(key), update: async (key, value) => { data.set(key, value); } });
const gardenService = createGardenService({ storage, historyReader: createHistoryReader() });
const { garden } = await gardenService.scan(workspace);
// Keep this interaction fixture at eight real plants so it always has empty plots to arrange.
const snapshot = serializeGarden({ ...garden, plants: garden.plants.slice(-8) },
	[{ projectId: garden.projectId, projectName: garden.projectName }]);
assert.ok(snapshot.plants.length, 'Use a repository with at least one bug-fix commit.');
const fixture = join(artifacts, 'garden-preview.html');
const json = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
writeFileSync(fixture, `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src file:; script-src 'nonce-garden-preview';">
<link rel="stylesheet" href="../media/garden.css"><title>Bug Garden preview</title></head>
<body class="vscode-dark"><main id="garden" class="garden"></main>
<script nonce="garden-preview">
window.fixtureModel = ${json(snapshot)};
window.emptyModel = ${json(createEmptyViewModel())};
window.outbound = [];
window.uiErrors = [];
window.addEventListener('error', event => window.uiErrors.push(event.message));
window.addEventListener('unhandledrejection', event => window.uiErrors.push(String(event.reason)));
window.prefs = JSON.parse(localStorage.getItem('garden-preview-prefs') || '{"atmosphere":"day","slots":[]}');
window.pushGarden = () => window.postMessage({type:'garden/updated', payload:window.fixtureModel, preferences:window.prefs}, '*');
window.acquireVsCodeApi = () => ({
 getState: () => JSON.parse(localStorage.getItem('garden-preview-ui') || 'null'),
 setState: value => localStorage.setItem('garden-preview-ui', JSON.stringify(value)),
 postMessage: message => {
  window.outbound.push(message);
  if (message.type === 'garden/preferences') {
   window.prefs = structuredClone(message.preferences);
   localStorage.setItem('garden-preview-prefs', JSON.stringify(window.prefs));
   setTimeout(window.pushGarden, 0);
  } else if (['garden/ready', 'garden/refresh'].includes(message.type)) setTimeout(window.pushGarden, 0);
  else if (message.type === 'plant/copyCommit') window.postMessage({type:'garden/notice', message:'Commit hash copied.'}, '*');
 }
});
</script><script nonce="garden-preview" src="../media/glyphs.js"></script>
<script nonce="garden-preview" src="../media/garden.js"></script></body></html>`);
if (process.argv.includes('--fixture')) {
	console.log(`Local preview: ${fixture}`);
	process.exit(0);
}

const browserPath = process.env.BROWSER_PATH || [
	'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
	'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
	'/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find(existsSync);
if (!browserPath) throw new Error('Set BROWSER_PATH to a local Chrome, Chromium or Edge executable.');
const profile = mkdtempSync(join(artifacts, 'chrome-'));
const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
	`--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let launchError;
browser.on('error', (error) => { launchError = error; });
let socket;
let closeBrowser = async () => { browser.kill(); };
let passed = 0;
try {
	for (let attempt = 0; !existsSync(join(profile, 'DevToolsActivePort')); attempt++) {
		if (launchError) throw launchError;
		if (attempt > 100) throw new Error('Chromium did not start within 10 seconds.');
		await delay(100);
	}
	const port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0];
	const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
	socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
	await new Promise((accept, reject) => { socket.onopen = accept; socket.onerror = reject; });
	let sequence = 0;
	const pending = new Map();
	socket.onmessage = (event) => {
		const message = JSON.parse(event.data);
		const request = pending.get(message.id);
		if (!request) return;
		pending.delete(message.id);
		clearTimeout(request.timeout);
		if (message.error) request.reject(new Error(JSON.stringify(message.error)));
		else request.accept(message.result);
	};
	const call = (method, params = {}) => new Promise((accept, reject) => {
		const id = ++sequence;
		const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 10000);
		pending.set(id, { accept, reject, timeout });
		socket.send(JSON.stringify({ id, method, params }));
	});
	closeBrowser = async () => {
		try { await call('Browser.close'); } catch { browser.kill(); }
	};
	const evaluate = async (expression) => {
		const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
		if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception.description);
		return result.result.value;
	};
	const waitFor = async (expression) => {
		for (let attempt = 0; attempt < 100; attempt++) {
			if (await evaluate(expression)) return;
			await delay(20);
		}
		throw new Error(`UI condition timed out: ${expression}`);
	};
	const click = async (selector) => {
		await evaluate(`document.querySelector(${json(selector)}).focus(); document.querySelector(${json(selector)}).click()`);
		await delay(30);
	};
	const check = async (name, expression) => {
		assert.equal(await evaluate(expression), true, name);
		console.log(`PASS ${name}`);
		passed++;
	};
	const capture = async (name) => {
		const image = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
		writeFileSync(join(artifacts, name), Buffer.from(image.data, 'base64'));
	};
	await call('Page.enable');
	await call('Emulation.setDeviceMetricsOverride', { width: 1040, height: 850, deviceScaleFactor: 1, mobile: false });
	await call('Page.navigate', { url: pathToFileURL(fixture).href });
	await waitFor('document.querySelectorAll(".plot").length === 12');
	await check('renders real earned plants', 'document.querySelectorAll(".plot[data-plant-id]").length === fixtureModel.plants.length');
	await check('wide garden fits its viewport', 'document.documentElement.scrollWidth <= document.documentElement.clientWidth');
	await capture('garden-wide.png');
	await click('.plot[data-plant-id]');
	await check('selection reveals originating commit', 'document.querySelector(".commit-subject").textContent === fixtureModel.plants.find(p => p.instanceId === document.querySelector(".plot.is-selected").dataset.plantId).commitSubject');
	await click('.commit-copy');
	await check('copy requests the actual selected specimen', 'outbound.at(-1).type === "plant/copyCommit" && outbound.at(-1).instanceId === document.querySelector(".plot.is-selected").dataset.plantId');
	await click('[data-focus-key="tool-water"]');
	await click('.plot[data-plant-id]');
	await check('watering animates without creating plants', 'document.querySelector(".is-watered") !== null && fixtureModel.plants.length === ' + snapshot.plants.length);
	await click('[data-focus-key="tool-move"]');
	await click('.plot[data-plant-id]');
	const movedId = await evaluate('document.querySelector(".is-moving").dataset.plantId');
	await click('.plot--empty');
	await check('arrangement is saved with empty plots', `prefs.slots.includes(null) && prefs.slots.includes(${json(movedId)}) && outbound.some(m => m.type === 'garden/preferences')`);
	const arrangement = await evaluate('JSON.stringify(prefs.slots)');
	await click('[data-focus-key="atmosphere"]');
	await check('night changes scenery and is saved', 'prefs.atmosphere === "night" && document.querySelector(".scene").dataset.atmosphere === "night"');
	await capture('garden-night.png');
	await call('Page.reload');
	await waitFor('document.querySelector(".scene")?.dataset.atmosphere === "night"');
	await check('reload preserves scenery and arrangement', `JSON.stringify(prefs.slots) === ${json(arrangement)} && document.querySelector('.plot.is-selected').dataset.plantId === ${json(movedId)}`);
	await click('[data-focus-key="tool-move"]');
	await click('.plot[data-plant-id]');
	await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
	await check('Escape cancels arranging', 'document.querySelector(".is-moving") === null && document.querySelector("[role=status]").textContent.includes("cancelled")');
	await click('[data-focus-key="tab-collection"]');
	await check('collection includes every species and locked hints', 'document.querySelectorAll(".species-card").length === 11 && document.querySelector(".is-undiscovered") !== null');
	await click('.species-card.is-undiscovered');
	await check('undiscovered species explains its unlock condition', 'document.querySelector(".unlock-hint").textContent.length > 0 && document.querySelector(".inspector .eyebrow").textContent.includes("DISCOVERY")');
	await evaluate('const search = document.querySelector(".search"); search.focus(); search.value = "orchid"; search.setSelectionRange(6,6); search.dispatchEvent(new Event("input", {bubbles:true}));');
	await check('search filters and keeps keyboard focus', 'document.querySelectorAll(".species-card").length === 1 && document.activeElement.className === "search" && document.activeElement.selectionStart === 6');
	await evaluate('document.querySelector(".search").value = ""; document.querySelector(".search").dispatchEvent(new Event("input")); document.querySelector(".rarity-select").value = "legendary"; document.querySelector(".rarity-select").dispatchEvent(new Event("change"));');
	await check('rarity filter only shows matching species', '[...document.querySelectorAll(".species-card")].every(node => node.classList.contains("plant--legendary")) && document.querySelectorAll(".species-card").length > 0');
	await evaluate('document.querySelector(".rarity-select").value = "all"; document.querySelector(".rarity-select").dispatchEvent(new Event("change"));');
	await capture('garden-collection.png');
	await click('[data-focus-key="tab-achievements"]');
	await click('.achievement');
	await check('milestones show real progress and details', 'document.querySelectorAll(".achievement").length === fixtureModel.achievements.length && document.querySelector(".milestone-completion") !== null');
	await click('[data-focus-key="tab-garden"]');
	await click('[data-focus-key="refresh"]');
	await check('refresh finishes and gives feedback', '!document.querySelector("[data-focus-key=refresh]").disabled && document.querySelector("[role=status]").textContent.includes("caught up")');
	await click('[aria-label="Open full garden"]');
	await check('expand requests the editor view', 'outbound.at(-1).type === "garden/expand"');
	await call('Emulation.setDeviceMetricsOverride', { width: 320, height: 1100, deviceScaleFactor: 1, mobile: false });
	await check('320px sidebar fits without horizontal overflow', 'document.documentElement.scrollWidth <= document.documentElement.clientWidth && document.querySelector(".plot").getBoundingClientRect().width >= 40');
	await capture('garden-sidebar.png');
	await evaluate('document.body.className = "vscode-light"');
	await check('light theme uses a light surface', 'getComputedStyle(document.body).backgroundColor === "rgb(247, 246, 239)"');
	await capture('garden-light.png');
	await evaluate('document.body.className = "vscode-dark vscode-reduce-motion"');
	await click('[data-focus-key="tool-move"]');
	await click('.plot[data-plant-id]');
	await check('reduced motion disables movement', 'getComputedStyle(document.querySelector(".is-moving .plot-art")).animationName === "none"');
	await click('[data-focus-key="tool-inspect"]');
	await evaluate('window.fixtureModel.plants[0].commitSubject = "<img src=x onerror=alert(1)>"; window.pushGarden();');
	await delay(30);
	await evaluate(`document.querySelector('[data-plant-id="' + fixtureModel.plants[0].instanceId + '"]').click()`);
	await check('commit text is never injected as HTML', 'document.querySelector(".commit-subject").textContent.startsWith("<img") && document.querySelectorAll("img").length === 0');
	await evaluate('document.querySelector(".plot[data-plant-id]").focus()');
	await call('Page.bringToFront');
	await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 });
	await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
	await check('keyboard selects a plant and preserves focus', 'document.activeElement.classList.contains("plot") && document.activeElement.getAttribute("aria-pressed") === "true"');
	await evaluate(`(() => {
		const source = document.querySelector('.plot[data-plant-id]');
		const target = document.querySelector('.plot--empty');
		window.draggedId = source.dataset.plantId;
		window.droppedSlot = Number(target.dataset.slot);
		const transfer = new DataTransfer();
		source.dispatchEvent(new DragEvent('dragstart', {dataTransfer:transfer, bubbles:true}));
		target.dispatchEvent(new DragEvent('drop', {dataTransfer:transfer, bubbles:true, cancelable:true}));
	})()`);
	await delay(30);
	await check('drag and drop reaches an empty plot', 'prefs.slots[droppedSlot] === draggedId');
	await evaluate(`window.originalModel = structuredClone(fixtureModel);
		fixtureModel.plants = Array.from({length: 15}, (_, index) => ({...originalModel.plants[0], instanceId:'test-'+index}));
		prefs.slots = [];
		window.pushGarden()`);
	await waitFor('document.querySelector(".pagination") !== null');
	await check('new plants receive bloom feedback', 'document.querySelectorAll(".plot.is-new").length > 0 && document.querySelector("[role=status]").textContent.includes("15 new plants")');
	await click('[aria-label="Next garden bed"]');
	await check('pagination shows plants beyond the first twelve', 'document.querySelectorAll(".plot[data-plant-id]").length === 3 && document.querySelector(".pagination > span").textContent === "2/2"');
	await evaluate('fixtureModel = {...originalModel, projectId:"another-project", projectName:"Another project", plants:[]}; prefs = {atmosphere:"day",slots:[]}; window.pushGarden()');
	await waitFor('document.querySelector(".first-fix") !== null');
	await check('project changes reset stale selection and offer a first-fix guide', 'document.querySelector(".garden-title").textContent === "Another project" && document.querySelector(".scene").dataset.atmosphere === "day" && document.querySelectorAll(".plot[data-plant-id]").length === 0');
	await evaluate('window.postMessage({type:"garden/updated", payload:emptyModel, preferences:{atmosphere:"day", slots:[]}}, "*")');
	await waitFor('document.querySelector(".welcome-garden") !== null');
	await click('[aria-label="Open a project"]');
	await check('empty workspace offers a working open-folder action', 'outbound.at(-1).type === "garden/openFolder"');
	await check('empty state also fits at 320px', 'document.documentElement.scrollWidth <= document.documentElement.clientWidth');
	await check('no browser runtime errors', 'uiErrors.length === 0');
	console.log(`${passed} browser checks passed. Screenshots: ${artifacts}`);
} finally {
	await closeBrowser();
	if (socket?.readyState === WebSocket.OPEN) socket.close();
	await delay(200);
	// Delete only the temporary profile created by this run, inside this workspace's artifacts.
	if (resolve(profile).startsWith(resolve(artifacts) + sep) && basename(profile).startsWith('chrome-')) {
		try { rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
		catch { /* A remaining Chromium lock may keep this ignored temporary profile on Windows. */ }
	}
}
