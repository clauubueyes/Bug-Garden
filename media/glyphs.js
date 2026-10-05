/* Original local illustrations. Only this trusted artwork is inserted as markup. */
(function () {
	const glyph = (art) => `<svg viewBox="0 0 96 104" aria-hidden="true" focusable="false"><ellipse cx="48" cy="92" rx="22" ry="5" fill="#264d35" opacity=".18"/>${art}</svg>`;
	const stem = '<path d="M48 91C46 72 51 63 48 43" fill="none" stroke="#467247" stroke-width="5" stroke-linecap="round"/>';
	const leaves = '<path d="M48 78C30 79 25 67 25 61C39 60 48 67 48 78" fill="#80b965"/><path d="M48 69C61 70 69 60 70 51C54 51 47 59 48 69" fill="#4f945b"/><path d="M31 66L47 77M64 57L49 68" stroke="#3f7549" stroke-width="1.6" fill="none"/>';
	window.BUG_GARDEN_GLYPHS = {
		sprout: glyph('<path d="M48 91C46 72 50 56 48 44" stroke="#477e4c" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M48 59C26 60 14 43 18 26C37 24 52 36 48 59" fill="#91c976"/><path d="M49 68C69 69 82 57 80 40C62 37 47 50 49 68" fill="#579e64"/><path d="M25 33C35 38 42 46 48 59M72 47L49 67" stroke="#3e7748" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M22 30C25 30 31 30 35 34" stroke="#c7e4a3" stroke-width="3" fill="none" stroke-linecap="round"/>'),
		tulip: glyph(stem + leaves + '<path d="M26 29L38 35L48 21L59 35L71 28C72 48 64 60 49 60C34 59 26 48 26 29" fill="#ea8a91"/><path d="M48 21C58 29 64 43 49 59C39 48 39 32 48 21" fill="#f7abb0"/><path d="M29 36C28 47 36 56 47 58M68 35C66 46 61 53 51 58" stroke="#ca687a" stroke-width="2" fill="none" stroke-linecap="round"/>'),
		sunflower: glyph(stem + leaves + Array.from({ length: 10 }, (_, i) => `<ellipse cx="48" cy="18" rx="7" ry="14" fill="${i % 2 ? '#eab655' : '#f4cd73'}" transform="rotate(${i * 36} 48 36)"/>`).join('') + '<circle cx="48" cy="36" r="14" fill="#98653f"/><circle cx="48" cy="36" r="10" fill="#b6804b"/><path d="M43 31h1M51 29h1M47 36h1M40 39h1M53 39h1M47 44h1" stroke="#6d4e38" stroke-width="3" stroke-linecap="round"/>'),
		fern: glyph('<path d="M47 92C45 66 47 44 53 19" stroke="#416f47" stroke-width="4" fill="none" stroke-linecap="round"/>' + [0, 1, 2, 3, 4].map((n) => `<path d="M${48 + n} ${77 - n * 12}C${24 + n * 4} ${79 - n * 12} ${20 + n * 5} ${65 - n * 10} ${24 + n * 5} ${55 - n * 8}C${38 + n * 2} ${54 - n * 8} ${48 + n} ${66 - n * 12} ${48 + n} ${77 - n * 12}" fill="${n % 2 ? '#74af68' : '#91c680'}"/><path d="M${48 + n} ${77 - n * 12}C${73 - n * 3} ${79 - n * 12} ${65 - n * 3} ${52 - n * 8} ${74 - n * 4} ${55 - n * 8}C${60 - n} ${54 - n * 8} ${48 + n} ${66 - n * 12} ${48 + n} ${77 - n * 12}" fill="#56965d"/>`).join('')),
		cactus: glyph('<path d="M36 91V37C36 20 62 20 62 37V91" fill="#7abc94"/><path d="M37 70H27C17 70 15 64 15 56V48C15 39 29 39 29 48V57H38M61 58H69V39C69 31 82 31 82 40V57C82 68 76 73 60 73" fill="#65a981"/><path d="M46 34V85M55 33V85" stroke="#a6d6a9" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M23 49v10M75 41v17" stroke="#95cda1" stroke-width="2" fill="none"/><path d="M32 91h34" stroke="#44765b" stroke-width="3" stroke-linecap="round"/><path d="M48 25C37 14 43 9 49 17C55 6 63 12 54 23" fill="#f3acb4"/>'),
		mushroom: glyph('<path d="M39 48L36 85C36 98 60 98 60 85L57 48" fill="#f4dfb5"/><path d="M52 55L53 88" stroke="#d7ba8f" stroke-width="3"/><path d="M13 51C17 12 78 9 84 51C70 63 28 64 13 51" fill="#de7a70"/><path d="M16 51C36 41 63 40 81 51C62 60 35 61 16 51" fill="#f3c9ae"/><circle cx="32" cy="35" r="7" fill="#fce7c8"/><circle cx="61" cy="28" r="6" fill="#fce7c8"/><circle cx="70" cy="44" r="4" fill="#fce7c8"/><path d="M24 26C31 20 39 18 46 18" stroke="#edaaa0" stroke-width="3" fill="none" stroke-linecap="round"/>'),
		lotus: glyph('<ellipse cx="49" cy="87" rx="34" ry="10" fill="#59977d"/><path d="M18 85C35 75 61 75 79 85" stroke="#8cbaa0" stroke-width="2" fill="none"/><path d="M48 84C15 85 11 57 18 41C33 44 45 57 48 84" fill="#d786ad"/><path d="M48 84C80 85 85 57 79 41C63 44 52 57 48 84" fill="#d786ad"/><path d="M48 83C29 68 30 44 47 25C65 43 67 67 48 83" fill="#f0b1c8"/><path d="M48 84C28 81 23 66 23 57C34 57 46 70 48 84M48 84C68 81 75 66 74 57C64 57 50 70 48 84" fill="#ee9dbc"/><path d="M48 43V74" stroke="#ffdbdd" stroke-width="2"/>'),
		monstera: glyph('<path d="M48 93V70" stroke="#46714c" stroke-width="5" stroke-linecap="round"/><path d="M48 77C28 80 12 61 12 41C12 17 41 10 48 27C60 8 86 19 85 42C83 62 67 78 48 77Z M29 31a5 8 0 1 0 0 16a5 8 0 1 0 0-16 M67 33a5 8 0 1 0 0 16a5 8 0 1 0 0-16 M33 55a4 5 0 1 0 0 10a4 5 0 1 0 0-10 M62 56a4 5 0 1 0 0 10a4 5 0 1 0 0-10" fill="#4c9674" fill-rule="evenodd"/><path d="M48 30V73" stroke="#92c997" stroke-width="2"/><path d="M17 24C22 19 29 18 34 20" stroke="#7cba86" stroke-width="3" fill="none" stroke-linecap="round"/>'),
		orchid: glyph('<path d="M46 92C63 62 37 47 51 24" stroke="#578663" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M46 92C20 87 19 74 23 64C43 65 52 78 46 92M49 85C70 83 77 70 74 61C57 62 46 74 49 85" fill="#6ba87b"/>' + [[49, 34], [57, 60]].map(([x, y]) => `<g transform="translate(${x} ${y})"><ellipse cy="-8" rx="9" ry="12" fill="#d4b1df"/><ellipse cx="-11" cy="-2" rx="13" ry="8" transform="rotate(20)" fill="#e8cbe9"/><ellipse cx="11" cy="-2" rx="13" ry="8" transform="rotate(-20)" fill="#e8cbe9"/><ellipse cy="9" rx="9" ry="8" fill="#b486c4"/><circle r="4" fill="#f3d294"/></g>`).join('')),
		oak: glyph('<path d="M39 92L43 52L35 43M57 92L53 53L64 41" stroke="#967147" stroke-width="8" stroke-linecap="round" fill="none"/><path d="M47 63V87" stroke="#bc9463" stroke-width="4" stroke-linecap="round"/><path d="M28 63C10 62 8 43 21 36C15 21 34 12 44 19C56 6 74 14 73 28C94 28 95 48 80 56C80 69 60 73 51 64C43 72 31 71 28 63" fill="#719e59"/><path d="M25 36C24 23 43 18 50 31C60 20 80 28 76 43C90 50 77 61 65 58C59 67 44 59 44 53C31 63 18 54 25 36" fill="#8cb86e"/><path d="M34 28C38 25 43 25 46 28" stroke="#c0d28c" stroke-width="3" fill="none" stroke-linecap="round"/>'),
		sakura: glyph('<path d="M44 93L50 59L35 38M50 66L71 44M49 57L51 25" stroke="#9e795d" stroke-width="6" fill="none" stroke-linecap="round"/>' + [[27, 36, 16], [48, 25, 19], [69, 37, 20], [40, 47, 18], [62, 54, 15]].map(([x, y, r], n) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${n % 2 ? '#edb1c0' : '#f4c5cc'}"/><circle cx="${x - 5}" cy="${y - 5}" r="4" fill="#ffe2df"/>`).join('') + '<path d="M29 72l4 3M76 70l-3 4M62 82l3 2" stroke="#eab5bd" stroke-width="4" stroke-linecap="round"/>'),
	};
	const paths = {
		leaf: 'M20 4C10 2 3 7 4 14s9 7 13 2 3-12 3-12ZM6 18l9-9',
		sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
		moon: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z',
		drop: 'M12 3C10 7 5 11 5 15a7 7 0 0 0 14 0c0-4-5-8-7-12ZM8 15c0 2 1 3 3 3',
		inspect: 'M10 4a6 6 0 1 0 0 12a6 6 0 1 0 0-12Zm5 11 5 5',
		move: 'M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4',
		grid: 'M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4ZM14 14h6v6h-6Z',
		trophy: 'M7 3h10v7a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 15v5m-4 1h8',
		expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6',
		refresh: 'M20 8a8 8 0 1 0 0 8M20 3v5h-5',
		left: 'M15 5l-7 7 7 7',
		right: 'M9 5l7 7-7 7',
		copy: 'M9 9h11v12H9ZM15 9V3H3v12h6',
		lock: 'M6 11h12v10H6ZM8 11V7a4 4 0 0 1 8 0v4',
		check: 'M5 12l4 4L19 6',
		plus: 'M12 5v14M5 12h14',
	};
	window.BUG_GARDEN_ICONS = Object.fromEntries(Object.entries(paths).map(([name, path]) => [name,
		`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`,
	]));
})();
