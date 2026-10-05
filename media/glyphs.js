/*
 * Static SVG glyphs, one per species. These strings never contain user data, so they are the
 * only markup inserted with innerHTML. Everything else is rendered with textContent.
 */
(function () {
	const glyph = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;

	window.BUG_GARDEN_GLYPHS = {
		sprout: glyph(
			'<path d="M12 21v-9" /><path d="M12 13c0-3.3-2.7-6-6-6 0 3.3 2.7 6 6 6Z" /><path d="M12 15c0-2.8 2.2-5 5-5 0 2.8-2.2 5-5 5Z" />',
		),
		tulip: glyph(
			'<path d="M12 21v-8" /><path d="M12 13c-3 0-5-2.2-5-5 0-2.8 2.2-5 5-5s5 2.2 5 5c0 2.8-2 5-5 5Z" /><path d="M12 13v-10" />',
		),
		sunflower: glyph(
			'<circle cx="12" cy="10" r="3" /><path d="M12 2v3M12 15v3M4 10h3M17 10h3M6.3 4.3l2.1 2.1M15.6 13.6l2.1 2.1M17.7 4.3l-2.1 2.1M8.4 13.6l-2.1 2.1" /><path d="M12 21v-6" />',
		),
		fern: glyph(
			'<path d="M12 21c0-5 0-9 0-14" /><path d="M12 8c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4Z" /><path d="M12 8c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4Z" /><path d="M12 13c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4Z" /><path d="M12 13c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4Z" />',
		),
		cactus: glyph(
			'<path d="M10 21v-9a2 2 0 0 1 4 0v9" /><path d="M8 12a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2" /><path d="M16 13a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2" /><path d="M8 21h8" />',
		),
		mushroom: glyph(
			'<path d="M4 11a8 8 0 0 1 16 0Z" /><path d="M9.5 11v6a2.5 2.5 0 0 0 5 0v-6" /><path d="M6 21h12" />',
		),
		lotus: glyph(
			'<path d="M12 18c-4 0-7-2.7-7-6 2.6 0 4.8 1.2 7 4 2.2-2.8 4.4-4 7-4 0 3.3-3 6-7 6Z" /><path d="M12 16c-2-3-2-6 0-9 2 3 2 6 0 9Z" />',
		),
		monstera: glyph(
			'<path d="M12 21c-4 0-7-3.3-7-7.5C5 9 8 6 12 6s7 3 7 7.5c0 4.2-3 7.5-7 7.5Z" /><path d="M12 6v15M5.6 11.5h12.8M8 21c1.3-5 1.3-10 1.3-15" />',
		),
		orchid: glyph(
			'<path d="M12 12c-2-2-2-5 0-8 2 3 2 6 0 8Z" /><path d="M12 12c2-2 2-5 0-8 2 3 2 6 0 8Z" /><path d="M12 12c-2 2-5 2-8 0 3-2 6-2 8 0Z" /><path d="M12 12c2 2 5 2 8 0-3-2-6-2-8 0Z" /><path d="M12 12v9" />',
		),
		oak: glyph(
			'<path d="M12 21v-6" /><path d="M12 15c-4 0-7-2.7-7-6 0-2.8 2.2-5 5-5h4c2.8 0 5 2.2 5 5 0 3.3-3 6-7 6Z" /><path d="M8 15v6M16 15v6" />',
		),
		sakura: glyph(
			'<path d="M3 20c4-2 6-5 9-11" /><circle cx="16" cy="7" r="3" /><circle cx="8" cy="12" r="2.5" /><path d="M16 7c0-1.7 1.3-3 3-3M16 7c0 1.7 1.3 3 3 3M8 12c-1.4 0-2.5-1.1-2.5-2.5" />',
		),
	};
})();