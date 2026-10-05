/* Local garden UI. Earned plants come from the extension; care and arrangement are presentation. */
(function () {
	const vscode = acquireVsCodeApi();
	const root = document.getElementById('garden');
	const saved = vscode.getState() || {};
	const state = {
		model: null, projectId: saved.projectId || null,
		tab: ['garden', 'collection', 'achievements'].includes(saved.tab) ? saved.tab : 'garden',
		selectedId: saved.selectedId || null, speciesId: null, achievementId: null,
		tool: 'inspect', movingId: null, page: 0, slots: [], atmosphere: 'day',
		search: '', rarity: 'all', refreshing: false, notice: '', watered: new Set(), newPlants: new Set(),
	};
	const PAGE_SIZE = 12;
	const el = (tag, className, text) => {
		const node = document.createElement(tag);
		if (className) node.className = className;
		if (text !== undefined) node.textContent = text;
		return node;
	};
	const send = (type, extra) => vscode.postMessage({ type, ...extra });
	const icon = (name) => {
		const node = el('span', 'icon');
		node.insertAdjacentHTML('afterbegin', window.BUG_GARDEN_ICONS[name] || window.BUG_GARDEN_ICONS.leaf);
		return node;
	};
	const art = (glyph, className) => {
		const node = el('span', `illustration ${className || ''}`);
		node.insertAdjacentHTML('afterbegin', window.BUG_GARDEN_GLYPHS[glyph] || window.BUG_GARDEN_GLYPHS.sprout);
		return node;
	};
	function button(label, iconName, action, className = 'button') {
		const node = el('button', className);
		node.type = 'button';
		node.dataset.focusKey = `action-${label}`;
		node.setAttribute('aria-label', label);
		node.title = label;
		if (iconName) node.appendChild(icon(iconName));
		if (!className.includes('icon-button')) node.appendChild(el('span', null, label));
		node.addEventListener('click', action);
		return node;
	}
	function remember() {
		vscode.setState({ projectId: state.projectId, tab: state.tab, selectedId: state.selectedId });
	}
	function savePreferences() {
		if (state.projectId) send('garden/preferences', {
			projectId: state.projectId, preferences: { atmosphere: state.atmosphere, slots: state.slots },
		});
	}
	function announce(message) {
		state.notice = message;
		const notice = document.getElementById('garden-notice');
		if (notice) notice.textContent = message;
	}
	function selectPlant(id) {
		state.selectedId = id;
		state.speciesId = null;
		remember();
	}
	function changeTab(tab) {
		state.tab = tab;
		state.speciesId = null;
		state.achievementId = null;
		remember();
		render();
	}
	function selectedPlant() {
		return state.model.plants.find((plant) => plant.instanceId === state.selectedId);
	}
	function resolveSlots(plants, preferences) {
		const ids = new Set(plants.map((plant) => plant.instanceId));
		const placed = new Set();
		const slots = (preferences.slots || []).map((id) => {
			if (!id || !ids.has(id) || placed.has(id)) return null;
			placed.add(id);
			return id;
		});
		for (const plant of [...plants].reverse()) {
			if (placed.has(plant.instanceId)) continue;
			const empty = slots.indexOf(null);
			if (empty === -1) slots.push(plant.instanceId);
			else slots[empty] = plant.instanceId;
			placed.add(plant.instanceId);
		}
		return slots;
	}
	function movePlant(id, index) {
		const from = state.slots.indexOf(id);
		if (from < 0) return;
		while (state.slots.length <= index) state.slots.push(null);
		const displaced = state.slots[index];
		state.slots[index] = id;
		state.slots[from] = displaced;
		state.movingId = null;
		selectPlant(id);
		savePreferences();
		render();
		announce('Plant moved. A little more room to grow.');
	}
	function waterPlant(id) {
		state.watered.add(id);
		selectPlant(id);
		render();
		announce('A little water, just for fun. Your fixes are what make the garden grow.');
		setTimeout(() => {
			state.watered.delete(id);
			const plot = [...root.querySelectorAll('[data-plant-id]')].find((node) => node.dataset.plantId === id);
			if (plot) plot.classList.remove('is-watered');
		}, 1600);
	}
	function refresh() {
		state.refreshing = true;
		render();
		announce('Looking for new fixes…');
		send('garden/refresh');
	}
	function renderHeader() {
		const header = el('header', 'garden-header');
		const row = el('div', 'brand-row');
		const brand = el('div', 'brand');
		brand.append(icon('leaf'), el('span', null, 'BUG GARDEN'));
		const actions = el('div', 'header-actions');
		const refreshButton = button('Refresh garden', 'refresh', refresh, 'icon-button');
		refreshButton.disabled = state.refreshing;
		refreshButton.classList.toggle('is-spinning', state.refreshing);
		refreshButton.dataset.focusKey = 'refresh';
		actions.append(refreshButton, button('Open full garden', 'expand', () => send('garden/expand'), 'icon-button'));
		row.append(brand, actions);
		header.appendChild(row);
		if (!state.model || !state.model.projectId) return header;
		const titleRow = el('div', 'title-row');
		const title = el('h1', 'garden-title', state.model.projectName);
		title.title = state.model.projectName;
		titleRow.append(title, el('span', 'level-badge', `LV. ${state.model.summary.gardenLevel}`));
		header.append(titleRow, el('p', 'garden-subtitle', 'Good fixes. Little green things.'));
		if (state.model.projects.length > 1) {
			const select = el('select', 'project-select');
			select.setAttribute('aria-label', 'Choose project');
			for (const project of state.model.projects) {
				const option = el('option', null, project.projectName);
				option.value = project.projectId;
				option.selected = project.projectId === state.projectId;
				select.appendChild(option);
			}
			select.addEventListener('change', () => send('project/select', { projectId: select.value }));
			header.appendChild(select);
		}
		const stats = el('div', 'garden-stats');
		const discovered = state.model.catalogue.filter((species) => species.count > 0).length;
		stats.append(el('span', null, `${state.model.plants.length} plants`), el('span', null, `${discovered}/${state.model.catalogue.length} species`));
		const streak = el('span', 'streak', `${state.model.summary.currentStreak} day streak`);
		streak.prepend(icon('sun'));
		stats.appendChild(streak);
		header.appendChild(stats);
		return header;
	}
	function renderTabs() {
		const nav = el('nav', 'tabs');
		nav.setAttribute('aria-label', 'Garden views');
		for (const [id, label, symbol] of [['garden', 'Garden', 'leaf'], ['collection', 'Collection', 'grid'], ['achievements', 'Milestones', 'trophy']]) {
			const tab = button(label, symbol, () => changeTab(id), 'tab');
			tab.dataset.focusKey = `tab-${id}`;
			tab.setAttribute('aria-pressed', String(state.tab === id));
			nav.appendChild(tab);
		}
		return nav;
	}
	function renderScene() {
		const wrapper = el('section', 'garden-playground');
		wrapper.setAttribute('aria-label', 'Your interactive garden');
		const scene = el('div', 'scene');
		scene.dataset.atmosphere = state.atmosphere;
		scene.dataset.tool = state.tool;
		const scenery = el('div', 'scene-scenery');
		scenery.setAttribute('aria-hidden', 'true');
		scenery.append(el('span', 'scene-sun'), el('span', 'scene-cloud scene-cloud--one'), el('span', 'scene-cloud scene-cloud--two'), el('span', 'scene-hill scene-hill--back'), el('span', 'scene-hill scene-hill--front'));
		const house = el('span', 'scene-house');
		house.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 110 95"><path d="M18 44L55 13L92 44V87H18Z" fill="#d8dbc0"/><path d="M12 46L55 8L98 46" fill="none" stroke="#69816b" stroke-width="7" stroke-linejoin="round"/><path d="M28 48h54v34H28Z" fill="#a7c6bb"/><path d="M55 24v61M29 48l26-24 26 24M28 64h54M39 37v48M71 37v48" stroke="#e7ecd6" stroke-width="3" fill="none"/><path d="M15 87h80" stroke="#60795b" stroke-width="5" stroke-linecap="round"/></svg>');
		scenery.appendChild(house);
		scene.appendChild(scenery);
		const sceneTop = el('div', 'scene-top');
		sceneTop.append(el('span', 'scene-label', state.atmosphere === 'day' ? 'A quiet little corner' : 'Under the little stars'));
		const atmosphere = button(state.atmosphere === 'day' ? 'Switch to night' : 'Switch to day', state.atmosphere === 'day' ? 'moon' : 'sun', () => {
			state.atmosphere = state.atmosphere === 'day' ? 'night' : 'day';
			savePreferences();
			render();
		}, 'icon-button atmosphere-button');
		atmosphere.dataset.focusKey = 'atmosphere';
		sceneTop.appendChild(atmosphere);
		scene.appendChild(sceneTop);
		const plots = el('div', 'plots');
		const byId = new Map(state.model.plants.map((plant) => [plant.instanceId, plant]));
		for (let offset = 0; offset < PAGE_SIZE; offset++) {
			const index = state.page * PAGE_SIZE + offset;
			plots.appendChild(renderPlot(byId.get(state.slots[index]), index));
		}
		scene.appendChild(plots);
		const hint = el('div', 'scene-hint');
		hint.append(icon(state.tool === 'water' ? 'drop' : state.tool === 'move' ? 'move' : 'inspect'), el('span', null,
			state.tool === 'move' ? (state.movingId ? 'Now choose its new plot.' : 'Choose a plant, then its new plot.')
				: state.tool === 'water' ? 'Click a plant to give it a little drink.' : 'Click a plant. There’s a fix behind every leaf.'));
		scene.appendChild(hint);
		wrapper.append(scene, renderTools());
		if (!state.model.plants.length) {
			const tip = el('div', 'first-fix');
			tip.append(el('strong', null, 'Your first bloom is one fix away.'), el('span', null, 'Commit an improvement with a message like'), el('code', null, 'fix: repair the login button'));
			wrapper.appendChild(tip);
		}
		return wrapper;
	}
	function renderPlot(plant, index) {
		const plot = el('button', `plot${plant ? ` plant--${plant.rarity}` : ' plot--empty'}`);
		plot.type = 'button';
		plot.dataset.focusKey = `plot-${index}`;
		plot.dataset.slot = String(index);
		if (!plant && state.tool !== 'move') plot.tabIndex = -1;
		plot.setAttribute('aria-label', plant ? `${plant.name}, ${plant.rarityLabel}, plot ${index + 1}` : `Empty plot ${index + 1}`);
		if (plant) {
			plot.dataset.plantId = plant.instanceId;
			plot.classList.toggle('is-selected', state.selectedId === plant.instanceId);
			plot.classList.toggle('is-moving', state.movingId === plant.instanceId);
			plot.classList.toggle('is-watered', state.watered.has(plant.instanceId));
			plot.classList.toggle('is-new', state.newPlants.has(plant.instanceId));
			plot.setAttribute('aria-pressed', String(state.selectedId === plant.instanceId));
			plot.append(art(plant.glyph, 'plot-art'), el('span', 'plot-label', plant.name), el('span', 'water-drops'));
			plot.draggable = state.tool !== 'water';
			plot.addEventListener('dragstart', (event) => {
				event.dataTransfer.setData('application/x-bug-garden-plant', plant.instanceId);
				event.dataTransfer.effectAllowed = 'move';
			});
		} else plot.appendChild(el('span', 'plot-seed', '·'));
		plot.addEventListener('click', () => {
			if (state.tool === 'move') {
				if (state.movingId) movePlant(state.movingId, index);
				else if (plant) { selectPlant(plant.instanceId); state.movingId = plant.instanceId; render(); }
			} else if (plant) {
				if (state.tool === 'water') waterPlant(plant.instanceId);
				else { selectPlant(plant.instanceId); render(); }
			}
		});
		plot.addEventListener('dragover', (event) => { event.preventDefault(); plot.classList.add('is-drop-target'); });
		plot.addEventListener('dragleave', () => plot.classList.remove('is-drop-target'));
		plot.addEventListener('drop', (event) => {
			event.preventDefault();
			plot.classList.remove('is-drop-target');
			const id = event.dataTransfer.getData('application/x-bug-garden-plant');
			if (state.slots.includes(id)) movePlant(id, index);
		});
		return plot;
	}
	function renderTools() {
		const bar = el('div', 'garden-tools');
		const group = el('div', 'tool-group');
		for (const [id, label, symbol] of [['inspect', 'Explore', 'inspect'], ['water', 'Water', 'drop'], ['move', 'Arrange', 'move']]) {
			const tool = button(label, symbol, () => { state.tool = id; state.movingId = null; render(); }, 'tool-button');
			tool.dataset.focusKey = `tool-${id}`;
			tool.setAttribute('aria-pressed', String(state.tool === id));
			group.appendChild(tool);
		}
		bar.appendChild(group);
		const pages = Math.max(1, Math.ceil(state.slots.length / PAGE_SIZE));
		if (pages > 1) {
			const pagination = el('div', 'pagination');
			const back = button('Previous garden bed', 'left', () => { state.page--; render(); }, 'icon-button');
			const next = button('Next garden bed', 'right', () => { state.page++; render(); }, 'icon-button');
			back.disabled = state.page === 0;
			next.disabled = state.page === pages - 1;
			pagination.append(back, el('span', null, `${state.page + 1}/${pages}`), next);
			bar.appendChild(pagination);
		}
		return bar;
	}
	function renderCollection() {
		const section = el('section', 'collection');
		const discovered = state.model.catalogue.filter((species) => species.count > 0).length;
		section.append(el('p', 'eyebrow', 'THE FIELD NOTES'), el('h2', 'section-title', 'Meet your little collection.'), el('p', 'muted', `${discovered} of ${state.model.catalogue.length} species found. Every new kind has a story.`));
		const filters = el('div', 'collection-filters');
		const search = el('input', 'search');
		search.type = 'search';
		search.placeholder = 'Find a species…';
		search.setAttribute('aria-label', 'Search species');
		search.value = state.search;
		search.dataset.focusKey = 'species-search';
		search.addEventListener('input', () => { state.search = search.value; render(); });
		const rarity = el('select', 'rarity-select');
		rarity.setAttribute('aria-label', 'Filter species by rarity');
		rarity.dataset.focusKey = 'rarity-filter';
		for (const value of ['all', 'common', 'rare', 'epic', 'legendary']) {
			const option = el('option', null, value === 'all' ? 'All rarities' : value[0].toUpperCase() + value.slice(1));
			option.value = value;
			option.selected = value === state.rarity;
			rarity.appendChild(option);
		}
		rarity.addEventListener('change', () => { state.rarity = rarity.value; render(); });
		filters.append(search, rarity);
		section.appendChild(filters);
		const list = el('div', 'species-grid');
		const species = state.model.catalogue.filter((entry) => (state.rarity === 'all' || entry.rarity === state.rarity)
			&& entry.name.toLowerCase().includes(state.search.toLowerCase()));
		for (const entry of [...species].sort((a, b) => Number(b.count > 0) - Number(a.count > 0))) {
			const card = el('button', `species-card plant--${entry.rarity}${entry.count ? '' : ' is-undiscovered'}`);
			card.type = 'button';
			card.dataset.focusKey = `species-${entry.id}`;
			card.setAttribute('aria-pressed', String(state.speciesId === entry.id));
			card.setAttribute('aria-label', `${entry.name}, ${entry.count ? `${entry.count} grown` : 'not discovered; show unlock hint'}`);
			card.append(art(entry.glyph), el('strong', null, entry.name), el('span', 'rarity-label', entry.rarityLabel));
			const count = el('span', 'species-count', entry.count ? `×${entry.count}` : 'Undiscovered');
			if (!entry.count) count.prepend(icon('lock'));
			card.appendChild(count);
			card.addEventListener('click', () => { state.speciesId = entry.id; render(); });
			list.appendChild(card);
		}
		if (!species.length) list.appendChild(el('p', 'empty-search', 'No species match. Try another name or rarity.'));
		section.appendChild(list);
		return section;
	}
	function renderAchievements() {
		const section = el('section', 'milestones');
		const unlocked = state.model.achievements.filter((entry) => entry.unlocked).length;
		section.append(el('p', 'eyebrow', 'LITTLE REASONS TO KEEP GOING'), el('h2', 'section-title', 'Small fixes. Big milestones.'), el('p', 'muted', `${unlocked} of ${state.model.achievements.length} milestones reached. One good fix at a time.`));
		const grid = el('div', 'achievement-grid');
		for (const achievement of state.model.achievements) {
			const card = el('button', `achievement${achievement.unlocked ? ' is-unlocked' : ''}`);
			card.type = 'button';
			card.dataset.focusKey = `achievement-${achievement.id}`;
			card.setAttribute('aria-pressed', String(state.achievementId === achievement.id));
			card.append(el('span', 'achievement-icon', achievement.icon));
			const text = el('span', 'achievement-text');
			text.append(el('strong', null, achievement.name), el('span', null, achievement.description));
			const progress = el('progress', 'achievement-progress');
			progress.max = 100;
			progress.value = achievement.progress;
			progress.setAttribute('aria-label', `${achievement.name} progress`);
			text.appendChild(progress);
			card.append(text, achievement.unlocked ? icon('check') : el('span', 'achievement-percent', `${Math.round(achievement.progress)}%`));
			card.addEventListener('click', () => { state.achievementId = achievement.id; render(); });
			grid.appendChild(card);
		}
		section.appendChild(grid);
		return section;
	}
	function renderInspector() {
		const panel = el('aside', 'inspector');
		panel.setAttribute('aria-label', 'Garden details');
		if (state.tab === 'achievements') return renderMilestoneDetails(panel);
		const species = state.tab === 'collection' && state.model.catalogue.find((entry) => entry.id === state.speciesId);
		const plant = species ? null : selectedPlant();
		const specimen = species || plant;
		if (!specimen) {
			panel.append(art('sprout', 'inspector-art'), el('p', 'eyebrow', 'A GARDEN OF GOOD WORK'), el('h2', 'section-title', 'Every fix has a story.'), el('p', 'muted', 'Choose a plant to meet it, or explore the collection to find your next discovery.'));
			return panel;
		}
		panel.classList.add(`plant--${specimen.rarity}`);
		panel.append(art(specimen.glyph, 'inspector-art'), el('span', 'rarity-pill', specimen.rarityLabel), el('h2', 'specimen-name', specimen.name), el('p', 'specimen-description', specimen.description));
		if (species) {
			panel.append(el('p', 'eyebrow', species.count ? `${species.count} GROWN IN THIS GARDEN` : 'YOUR NEXT DISCOVERY?'), el('h3', 'detail-title', 'How to grow one'), el('p', 'unlock-hint', species.conditionLabel));
			const found = state.model.plants.find((entry) => entry.speciesId === species.id);
			if (found) panel.appendChild(button('Find it in the garden', 'leaf', () => {
				selectPlant(found.instanceId);
				state.page = Math.floor(state.slots.indexOf(found.instanceId) / PAGE_SIZE);
				changeTab('garden');
			}, 'button primary-button'));
		} else {
			const story = el('div', 'commit-story');
			story.append(el('p', 'eyebrow', 'GREW FROM THIS FIX'), el('p', 'commit-subject', plant.commitSubject));
			const metadata = el('div', 'commit-meta');
			const copy = button(plant.shortSha, 'copy', () => send('plant/copyCommit', { projectId: state.projectId, instanceId: plant.instanceId }), 'commit-copy');
			copy.setAttribute('aria-label', 'Copy originating commit hash');
			metadata.append(copy, el('span', null, plant.obtainedDate));
			story.appendChild(metadata);
			panel.append(story, el('p', 'unlock-hint', plant.conditionLabel));
			if (plant.rarityReasons.length) panel.appendChild(el('p', 'muted', plant.rarityReasons.join(' · ')));
			const actions = el('div', 'specimen-actions');
			actions.append(button('Water', 'drop', () => waterPlant(plant.instanceId), 'button primary-button'), button('Move', 'move', () => {
				state.tool = 'move'; state.movingId = plant.instanceId; render();
			}, 'button'));
			panel.appendChild(actions);
		}
		return panel;
	}
	function renderMilestoneDetails(panel) {
		const achievement = state.model.achievements.find((entry) => entry.id === state.achievementId)
			|| [...state.model.achievements].filter((entry) => !entry.unlocked).sort((a, b) => b.progress - a.progress)[0];
		if (!achievement) {
			panel.append(icon('trophy'), el('h2', 'section-title', 'Look at you grow.'), el('p', 'muted', 'Every milestone in this garden is yours.'));
			return panel;
		}
		panel.append(el('span', 'milestone-large-icon', achievement.icon), el('p', 'eyebrow', achievement.unlocked ? 'YOU DID THIS' : 'A LITTLE CLOSER EVERY DAY'), el('h2', 'section-title', achievement.name), el('p', 'muted', achievement.description), el('span', 'milestone-completion', achievement.unlocked ? 'Milestone reached' : `${Math.round(achievement.progress)}% of the way there`));
		return panel;
	}
	function renderProgress() {
		const footer = el('footer', 'level-progress');
		const summary = state.model.summary;
		const label = el('div', 'level-progress-label');
		label.append(icon('leaf'), el('span', null, summary.gardenTitle), el('span', 'level-remaining', summary.plantsToNextLevel === null ? 'Fully grown' : `${summary.plantsToNextLevel} fixes to level ${summary.gardenLevel + 1}`));
		const progress = el('progress', 'level-progress-bar');
		progress.max = Math.max(1, summary.plantsDiscovered + (summary.plantsToNextLevel || 0));
		progress.value = summary.plantsDiscovered;
		progress.setAttribute('aria-label', 'Garden level progress');
		footer.append(label, progress);
		return footer;
	}
	function renderEmptyWorkspace() {
		const section = el('section', 'welcome-garden');
		const bouquet = el('div', 'welcome-bouquet');
		bouquet.append(art('tulip'), art('sprout'), art('sunflower'));
		section.append(bouquet, el('p', 'eyebrow', 'EVERY FIX MAKES SOMETHING GROW'), el('h1', 'garden-title', 'A little space to grow.'), el('p', 'muted', 'Open a project with Git. The bugs you fix will turn into plants, and this little garden will become yours.'), button('Open a project', 'plus', () => send('garden/openFolder'), 'button primary-button'));
		return section;
	}
	function render() {
		const active = document.activeElement;
		const focusKey = active && active.dataset.focusKey;
		const selection = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
		root.replaceChildren();
		root.appendChild(renderHeader());
		if (!state.model) root.appendChild(el('p', 'loading-garden', 'Waking up your little garden…'));
		else if (!state.model.projectId) root.appendChild(renderEmptyWorkspace());
		else {
			root.appendChild(renderTabs());
			const content = el('div', `garden-content garden-content--${state.tab}`);
			content.append(state.tab === 'garden' ? renderScene() : state.tab === 'collection' ? renderCollection() : renderAchievements(), renderInspector());
			root.append(content, renderProgress());
		}
		const notice = el('p', 'garden-notice', state.notice);
		notice.id = 'garden-notice';
		notice.setAttribute('role', 'status');
		notice.setAttribute('aria-live', 'polite');
		root.appendChild(notice);
		if (focusKey) {
			const target = [...root.querySelectorAll('[data-focus-key]')].find((node) => node.dataset.focusKey === focusKey);
			if (target && !target.disabled) {
				target.focus({ preventScroll: true });
				if (selection !== null && target.type === 'search') target.setSelectionRange(selection, selection);
			}
		}
	}
	window.addEventListener('message', (event) => {
		const message = event.data;
		if (!message) return;
		if (message.type === 'garden/notice') {
			if (state.refreshing) { state.refreshing = false; render(); }
			announce(message.message);
			return;
		}
		if (message.type !== 'garden/updated') return;
		const previous = state.model;
		const wasRefreshing = state.refreshing;
		const changedProject = state.projectId !== message.payload.projectId;
		state.model = message.payload;
		state.projectId = state.model.projectId;
		state.atmosphere = message.preferences ? message.preferences.atmosphere : 'day';
		state.slots = resolveSlots(state.model.plants, message.preferences || { slots: [] });
		state.refreshing = false;
		if (changedProject) { state.page = 0; state.speciesId = null; state.movingId = null; state.watered.clear(); state.notice = ''; }
		if (!state.model.plants.some((plant) => plant.instanceId === state.selectedId)) {
			state.selectedId = state.model.plants[0] ? state.model.plants[0].instanceId : null;
		}
		state.page = Math.min(state.page, Math.max(0, Math.ceil(state.slots.length / PAGE_SIZE) - 1));
		const oldIds = new Set(previous && !changedProject ? previous.plants.map((plant) => plant.instanceId) : state.model.plants.map((plant) => plant.instanceId));
		state.newPlants = new Set(state.model.plants.filter((plant) => !oldIds.has(plant.instanceId)).map((plant) => plant.instanceId));
		remember();
		render();
		if (state.newPlants.size) announce(`${state.newPlants.size} new plant${state.newPlants.size === 1 ? '' : 's'} grew. Good work.`);
		else if (wasRefreshing) announce('All caught up. Your garden is ready.');
	});
	window.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && state.movingId) { state.movingId = null; render(); announce('Move cancelled.'); }
	});
	render();
	send('garden/ready');
})();
