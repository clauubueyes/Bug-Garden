/*
 * Garden UI. The extension only sends plain snapshots; everything below builds DOM nodes and
 * sets textContent, so commit subjects and plant names are never parsed as HTML.
 */
(function () {
	const vscode = acquireVsCodeApi();
	const root = document.getElementById('garden');

	const state = {
		projectId: null,
		projectName: '',
		projects: [],
		plants: [],
		emptyMessage: null,
		selectedInstanceId: null,
	};

	function element(tag, className, text) {
		const node = document.createElement(tag);
		if (className) {
			node.className = className;
		}
		if (text !== undefined) {
			node.textContent = text;
		}
		return node;
	}

	function send(type, extra) {
		vscode.postMessage(Object.assign({ type: type }, extra || {}));
	}

	function selectedPlant() {
		return state.plants.find((plant) => plant.instanceId === state.selectedInstanceId) || null;
	}

	function renderHeader() {
		const header = element('header', 'garden__header');
		const project = element('div', 'garden__project');

		if (state.projects.length > 1) {
			const select = document.createElement('select');
			for (const option of state.projects) {
				const node = document.createElement('option');
				node.value = option.projectId;
				node.textContent = option.projectName;
				node.selected = option.projectId === state.projectId;
				select.appendChild(node);
			}
			select.addEventListener('change', (event) => {
				send('project/select', { projectId: event.target.value });
			});
			project.appendChild(select);
		} else {
			project.appendChild(element('span', null, state.projectName));
		}

		const refresh = element('button', 'garden__refresh', '↻');
		refresh.title = 'Refresh garden';
		refresh.addEventListener('click', () => send('garden/refresh'));
		project.appendChild(refresh);
		header.appendChild(project);

		const summary = element('div', 'garden__summary');
		const tile = element('div', 'garden__tile');
		tile.appendChild(element('span', 'garden__tile-value', String(state.plants.length)));
		tile.appendChild(element('span', 'garden__tile-label', 'Plants discovered'));
		summary.appendChild(tile);
		header.appendChild(summary);

		return header;
	}

	function renderBed() {
		const bed = element('div', 'garden__bed');
		const list = element('ul', 'garden__plants');
		for (const plant of state.plants) {
			list.appendChild(renderPlant(plant));
		}
		bed.appendChild(list);
		return bed;
	}

	function renderPlant(plant) {
		const item = document.createElement('li');
		const button = element('button', `plant plant--${plant.rarity}`);
		button.type = 'button';
		button.title = plant.name;
		button.setAttribute('aria-pressed', String(plant.instanceId === state.selectedInstanceId));

		const glyph = window.BUG_GARDEN_GLYPHS[plant.glyph] || window.BUG_GARDEN_GLYPHS.sprout;
		button.insertAdjacentHTML('afterbegin', glyph);
		button.appendChild(element('span', 'plant__name', plant.name));
		button.appendChild(element('span', 'plant__rarity', plant.rarityLabel));
		button.addEventListener('click', () => {
			state.selectedInstanceId = plant.instanceId;
			render();
		});

		item.appendChild(button);
		return item;
	}

	function renderDetails() {
		const plant = selectedPlant();
		if (!plant) {
			return element('p', 'garden__empty', 'Select a plant to see how it grew.');
		}

		const panel = element('section', 'garden__details');
		panel.appendChild(element('h3', null, `${plant.name} · ${plant.rarityLabel}`));
		panel.appendChild(element('p', 'garden__description', plant.description));

		const list = document.createElement('dl');
		addRow(list, 'Obtained by', plant.commitSubject);
		addRow(list, 'Commit', plant.shortSha);
		addRow(list, 'Date', plant.obtainedDate);
		addRow(list, 'Project', plant.projectName);
		addRow(list, 'Condition', plant.conditionLabel);
		if (plant.rarityReasons.length > 0) {
			addRow(list, 'Rarity because', plant.rarityReasons.join(', '));
		}
		panel.appendChild(list);
		return panel;
	}

	function renderEmpty() {
		return element('p', 'garden__empty', state.emptyMessage || 'Nothing planted yet.');
	}

	function render() {
		root.replaceChildren();

		if (state.projectId === null) {
			root.appendChild(renderEmpty());
			return;
		}

		root.appendChild(renderHeader());
		if (state.plants.length === 0) {
			root.appendChild(renderEmpty());
			return;
		}

		root.appendChild(renderBed());
		root.appendChild(renderDetails());
	}

	function addRow(list, label, value) {
		list.appendChild(element('dt', null, label));
		list.appendChild(element('dd', null, value));
	}

	window.addEventListener('message', (event) => {
		const message = event.data;
		if (!message || message.type !== 'garden/updated') {
			return;
		}

		state.projectId = message.payload.projectId;
		state.projectName = message.payload.projectName;
		state.projects = message.payload.projects;
		state.plants = message.payload.plants;
		state.emptyMessage = message.payload.emptyMessage;
		state.selectedInstanceId = null;
		render();
	});

	send('garden/ready');
	render();
})();