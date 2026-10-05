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
		summary: null,
		achievements: [],
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
			project.appendChild(element('span', 'garden__project-name', state.projectName));
		}

		const refresh = element('button', 'garden__refresh', '↻');
		refresh.title = 'Refresh garden';
		refresh.addEventListener('click', () => send('garden/refresh'));
		project.appendChild(refresh);
		header.appendChild(project);

		header.appendChild(renderSummary());
		return header;
	}

	function renderSummary() {
		const summary = element('div', 'garden__summary');
		summary.appendChild(tile(state.summary.gardenLevel, `Level · ${state.summary.gardenTitle}`));
		summary.appendChild(tile(state.summary.plantsDiscovered, 'Plants discovered'));
		summary.appendChild(tile(state.summary.currentStreak, 'Day streak'));
		summary.appendChild(tile(state.plants.length, 'Unique species'));
		return summary;
	}

	function tile(value, label) {
		const tile = element('div', 'garden__tile');
		tile.appendChild(element('span', 'garden__tile-value', String(value)));
		tile.appendChild(element('span', 'garden__tile-label', label));
		return tile;
	}

	function renderLevelProgress() {
		const progress = element('div', 'garden__progress');
		const total = state.summary.plantsDiscovered + (state.summary.plantsToNextLevel || 0);
		const done = state.summary.plantsDiscovered;
		const bar = element('div', 'garden__progress-bar');
		bar.style.width = total > 0 ? `${Math.round((done / total) * 100)}%` : '100%';
		bar.setAttribute('role', 'progressbar');
		bar.setAttribute('aria-valuenow', String(done));
		bar.setAttribute('aria-valuemin', '0');
		if (state.summary.plantsToNextLevel !== null) {
			bar.setAttribute('aria-valuemax', String(total));
		}
		progress.appendChild(bar);
		progress.appendChild(element('span', 'garden__progress-label', state.summary.levelProgressLabel));
		return progress;
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

	function renderRarest() {
		const panel = element('section', 'garden__rarest');
		const rarest = state.summary.rarestPlant;
		if (!rarest) {
			return null;
		}

		panel.appendChild(element('h3', null, 'Rarest plant'));
		const card = element('div', `garden__rarest-card plant--${rarest.rarity.toLowerCase()}`);
		card.insertAdjacentHTML(
			'afterbegin',
			window.BUG_GARDEN_GLYPHS[rarest.glyph] || window.BUG_GARDEN_GLYPHS.sprout,
		);
		card.appendChild(element('span', 'plant__name', rarest.name));
		card.appendChild(element('span', 'plant__rarity', rarest.rarityLabel));
		panel.appendChild(card);
		return panel;
	}

	function renderAchievements() {
		const panel = element('section', 'garden__achievements');
		panel.appendChild(element('h3', null, 'Achievements'));

		if (state.achievements.length === 0) {
			panel.appendChild(element('p', 'garden__empty', 'No achievements yet.'));
			return panel;
		}

		const list = element('ul', 'garden__achievement-list');
		const unlocked = state.achievements.filter((achievement) => achievement.unlocked);
		const sorted = unlocked.concat(state.achievements.filter((achievement) => !achievement.unlocked));

		for (const achievement of sorted) {
			const item = element('li', `achievement achievement--${achievement.tier}`);
			if (achievement.unlocked) {
				item.classList.add('achievement--unlocked');
			}
			item.appendChild(element('span', 'achievement__icon', achievement.icon));
			item.appendChild(element('span', 'achievement__name', achievement.name));
			item.appendChild(
				element(
					'span',
					'achievement__progress',
					achievement.unlocked ? 'Unlocked' : `${Math.round(achievement.progress)}%`,
				),
			);
			item.title = achievement.description;
			list.appendChild(item);
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
		root.appendChild(renderLevelProgress());

		if (state.plants.length === 0) {
			root.appendChild(renderEmpty());
			return;
		}

		root.appendChild(renderBed());
		const rarest = renderRarest();
		if (rarest) {
			root.appendChild(rarest);
		}
		root.appendChild(renderDetails());
		root.appendChild(renderAchievements());
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
		state.summary = message.payload.summary;
		state.achievements = message.payload.achievements;
		state.emptyMessage = message.payload.emptyMessage;
		state.selectedInstanceId = null;
		render();
	});

	send('garden/ready');
	render();
})();