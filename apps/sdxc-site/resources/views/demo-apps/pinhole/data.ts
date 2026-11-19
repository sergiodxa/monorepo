/**
 * Pinhole's world: invented people, their posts of drawn photographs, short reels, stories and
 * highlights, and the visitor signed in as Juno. Every screen reads these fixtures; nobody and
 * nothing here is real, and every picture is a scene drawn from a seed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoAppActionHref, demoAppHref } from "~/resources/views/demo-apps";

/** The folder name the app is served under. */
export const SLUG = "pinhole";

/** The address of a Pinhole screen. */
export const href = demoAppHref(SLUG);

/** The address a Pinhole form posts to. */
export const actionHref = demoAppActionHref(SLUG);

/** The fixed "now" every relative time is measured from, so pages render the same every day. */
export const NOW = Date.UTC(2026, 10, 18, 17, 30);

/** The scene a drawn photograph composes, each an original arrangement of simple shapes. */
export type Scene =
	| "dunes"
	| "harbor"
	| "peaks"
	| "city"
	| "still-life"
	| "ferns"
	| "tiles"
	| "bowls"
	| "loaves"
	| "road"
	| "waves"
	| "arch";

/** One drawn photograph: its scene, the four colours it is painted in, a seed and its alt text. */
export interface Photo {
	scene: Scene;
	/** Sky or wall, ground or table, the subject's colour, and the shadow ink. */
	palette: readonly [string, string, string, string];
	seed: number;
	alt: string;
}

/** A person on Pinhole. */
export interface Person {
	handle: string;
	name: string;
	bio: string;
	/** A link in the bio, shown without its scheme. */
	link?: string;
	/** The two hues their avatar is painted in. */
	hues: readonly [number, number];
	followers: number;
	following: number;
	/** Whether the visitor follows them before doing anything. */
	followed: boolean;
	verified?: boolean;
}

/** A comment under a post. */
export interface Comment {
	id: string;
	author: string;
	text: string;
	/** Minutes before {@link NOW}. */
	ago: number;
	likes: number;
}

/** A post: one to four photographs, a caption and its comments. */
export interface Post {
	id: string;
	author: string;
	photos: Photo[];
	caption: string;
	place?: string;
	/** The camera line set in mono under the place, like the edge of a negative. */
	exposure?: string;
	/** Minutes before {@link NOW}. */
	ago: number;
	likes: number;
	comments: Comment[];
	/** Topics the post shows under on Explore. */
	topics: string[];
	/** `portrait` frames the post 4:5; `square` 1:1. */
	frame: "square" | "portrait";
	/** People tagged in it, which their profile's Tagged tab lists. */
	tagged?: string[];
}

/** A reel: a short clip played over a drawn, moving scene. */
export interface Reel {
	id: string;
	author: string;
	caption: string;
	/** The sound line under the caption. */
	sound: string;
	scene: Photo;
	/** The reel's length in seconds, which the clip loops at. */
	seconds: number;
	/** The demo clip it plays, by running time. */
	clip: number;
	likes: number;
	comments: number;
	ago: number;
}

/** One story segment: a drawn photograph or a clip, and a sticker of text over it. */
export interface StorySegment {
	photo: Photo;
	/** Played over the photograph for this many seconds; a still lasts five. */
	clip?: { minutes: number; seconds: number };
	sticker?: string;
	/** Minutes before {@link NOW}. */
	ago: number;
}

/** A person's story for today. */
export interface Story {
	author: string;
	segments: StorySegment[];
	/** Whether the visitor has already watched it all. */
	seen: boolean;
}

/** A saved story on a profile, under its own cover. */
export interface Highlight {
	id: string;
	author: string;
	title: string;
	cover: Photo;
	segments: StorySegment[];
}

/** A topic Explore filters by. */
export interface Topic {
	id: string;
	name: string;
}

/** The visitor, signed in as a photographer who posts now and then. */
export const ME_HANDLE = "juno.arce";

/** Builds a photograph from a scene, its palette as hues, and alt text. */
function photo(scene: Scene, seed: number, palette: Photo["palette"], alt: string): Photo {
	return { scene, seed, palette, alt };
}

/** Paper, sand and dusk palettes, each sky, ground, subject, ink. */
const PALETTES = {
	dusk: [
		"oklch(0.78 0.09 40)",
		"oklch(0.55 0.08 30)",
		"oklch(0.93 0.07 80)",
		"oklch(0.3 0.05 300)",
	],
	sand: ["oklch(0.9 0.05 80)", "oklch(0.74 0.1 65)", "oklch(0.62 0.13 45)", "oklch(0.36 0.06 40)"],
	sea: [
		"oklch(0.86 0.05 220)",
		"oklch(0.5 0.09 230)",
		"oklch(0.96 0.02 90)",
		"oklch(0.28 0.05 240)",
	],
	alpine: [
		"oklch(0.82 0.06 245)",
		"oklch(0.56 0.05 250)",
		"oklch(0.97 0.01 240)",
		"oklch(0.34 0.04 260)",
	],
	night: [
		"oklch(0.3 0.07 280)",
		"oklch(0.2 0.04 270)",
		"oklch(0.85 0.13 80)",
		"oklch(0.13 0.02 270)",
	],
	clay: [
		"oklch(0.9 0.025 70)",
		"oklch(0.68 0.06 55)",
		"oklch(0.58 0.12 38)",
		"oklch(0.35 0.05 40)",
	],
	moss: [
		"oklch(0.88 0.04 120)",
		"oklch(0.52 0.09 140)",
		"oklch(0.72 0.12 135)",
		"oklch(0.3 0.06 150)",
	],
	tile: [
		"oklch(0.95 0.015 90)",
		"oklch(0.45 0.12 255)",
		"oklch(0.72 0.13 60)",
		"oklch(0.3 0.08 255)",
	],
	crust: ["oklch(0.86 0.03 70)", "oklch(0.5 0.06 55)", "oklch(0.7 0.12 65)", "oklch(0.36 0.06 45)"],
	asphalt: [
		"oklch(0.84 0.05 60)",
		"oklch(0.42 0.015 260)",
		"oklch(0.6 0.19 30)",
		"oklch(0.24 0.02 260)",
	],
	surf: [
		"oklch(0.9 0.04 200)",
		"oklch(0.62 0.1 200)",
		"oklch(0.98 0.01 200)",
		"oklch(0.35 0.07 210)",
	],
	plaster: [
		"oklch(0.92 0.03 60)",
		"oklch(0.8 0.05 50)",
		"oklch(0.95 0.06 90)",
		"oklch(0.45 0.07 40)",
	],
	ember: ["oklch(0.62 0.17 35)", "oklch(0.38 0.1 30)", "oklch(0.9 0.1 75)", "oklch(0.22 0.05 30)"],
} as const satisfies Record<string, Photo["palette"]>;

/** Everyone on Pinhole, the visitor first. */
export const PEOPLE: Person[] = [
	{
		handle: ME_HANDLE,
		name: "Juno Arce",
		bio: "Walks with a 35mm. Mostly harbours, sometimes bread.",
		link: "juno-arce.example",
		hues: [28, 70],
		followers: 1284,
		following: 311,
		followed: false,
	},
	{
		handle: "mara.quint",
		name: "Mara Quint",
		bio: "Ceramicist · wood-fired · open studio first Saturdays",
		link: "quintclay.example",
		hues: [40, 18],
		followers: 48200,
		following: 602,
		followed: true,
		verified: true,
	},
	{
		handle: "teo.lind",
		name: "Teo Lindqvist",
		bio: "Small boats, cold water, long exposures.",
		hues: [225, 190],
		followers: 9310,
		following: 488,
		followed: true,
	},
	{
		handle: "ines.bakes",
		name: "Inès Oduya",
		bio: "Sourdough at 4am so you don't have to. Bakery on Calle Sal.",
		link: "panoduya.example",
		hues: [65, 35],
		followers: 22150,
		following: 340,
		followed: true,
	},
	{
		handle: "kai.on.rock",
		name: "Kai Ferreira",
		bio: "Climbing guide. Granite > limestone, fight me.",
		hues: [250, 150],
		followers: 15020,
		following: 812,
		followed: true,
	},
	{
		handle: "noor.builds",
		name: "Noor Haddad",
		bio: "Architect. Arches, stairwells, afternoon light.",
		hues: [55, 15],
		followers: 31800,
		following: 270,
		followed: false,
		verified: true,
	},
	{
		handle: "lio.on.film",
		name: "Lio Marsh",
		bio: "Medium format, night streets, too many rolls in the fridge.",
		hues: [290, 330],
		followers: 7740,
		following: 920,
		followed: true,
	},
	{
		handle: "sana.grows",
		name: "Sana Okoye",
		bio: "Allotment 14B. Ferns, beans and the occasional disaster.",
		hues: [140, 95],
		followers: 5120,
		following: 401,
		followed: false,
	},
	{
		handle: "yuki.tiles",
		name: "Yuki Tanabe",
		bio: "Illustrator. I paint tiles and the tiles paint me back.",
		hues: [255, 60],
		followers: 18900,
		following: 155,
		followed: true,
	},
	{
		handle: "ola.surfs",
		name: "Ola Brenner",
		bio: "Cold-water surfer. Wetsuit is a lifestyle.",
		hues: [200, 175],
		followers: 11240,
		following: 530,
		followed: false,
	},
	{
		handle: "bram.rides",
		name: "Bram de Vries",
		bio: "Gravel, headwinds, cafe stops.",
		hues: [20, 260],
		followers: 3980,
		following: 211,
		followed: true,
	},
];

/** The topics Explore offers as chips. */
export const TOPICS: Topic[] = [
	{ id: "ceramics", name: "Ceramics" },
	{ id: "sea", name: "Sea" },
	{ id: "bread", name: "Bread" },
	{ id: "mountains", name: "Mountains" },
	{ id: "architecture", name: "Architecture" },
	{ id: "night", name: "Night" },
	{ id: "plants", name: "Plants" },
	{ id: "pattern", name: "Pattern" },
];

/** A comment, with its id derived from its post and place. */
function comment(
	post: string,
	index: number,
	author: string,
	text: string,
	ago: number,
	likes = 0,
) {
	return { id: `${post}-c${index}`, author, text, ago, likes };
}

/** Every post, newest first. */
export const POSTS: Post[] = [
	{
		id: "kiln-opening",
		author: "mara.quint",
		frame: "portrait",
		photos: [
			photo(
				"bowls",
				3,
				PALETTES.clay,
				"Five ash-glazed bowls cooling on a plank, each a different speckle",
			),
			photo("bowls", 11, PALETTES.ember, "The kiln door open, bowls glowing orange inside"),
			photo(
				"still-life",
				4,
				PALETTES.clay,
				"A single tall jar with a drip of green glaze on the shoulder",
			),
		],
		caption:
			"Opened the kiln this morning. Two cracked, eleven sang. The tall one is staying with me.",
		place: "Quint Clay Studio",
		exposure: "f/4 · 1/125 · ISO 400",
		ago: 42,
		likes: 3184,
		topics: ["ceramics"],
		tagged: ["sana.grows"],
		comments: [
			comment(
				"kiln-opening",
				1,
				"ines.bakes",
				"That speckle on the third one. I need it for the bakery.",
				31,
				24,
			),
			comment("kiln-opening", 2, "yuki.tiles", "the green drip!!", 25, 9),
			comment("kiln-opening", 3, "teo.lind", "Eleven singing is a good firing.", 18, 3),
			comment("kiln-opening", 4, "noor.builds", "Would love to see these on a long table.", 10, 1),
		],
	},
	{
		id: "harbor-fog",
		author: "teo.lind",
		frame: "square",
		photos: [
			photo("harbor", 7, PALETTES.sea, "Three moored sailboats in a pale harbour under fog"),
			photo("waves", 2, PALETTES.surf, "Low swell rolling into a breakwater"),
		],
		caption: "Fog came in at six and never left. Thirty-second exposures, the masts barely move.",
		place: "Nordhamn",
		exposure: "f/11 · 30s · ISO 100",
		ago: 95,
		likes: 1260,
		topics: ["sea"],
		comments: [
			comment(
				"harbor-fog",
				1,
				"ola.surfs",
				"Glassy though. Was it surfable round the point?",
				80,
				6,
			),
			comment("harbor-fog", 2, ME_HANDLE, "The second one is a print.", 60, 12),
			comment("harbor-fog", 3, "lio.on.film", "Tripod in fog is a whole sport", 44),
		],
	},
	{
		id: "first-loaves",
		author: "ines.bakes",
		frame: "portrait",
		photos: [
			photo("loaves", 5, PALETTES.crust, "Four scored sourdough loaves on a floured board"),
			photo("loaves", 9, PALETTES.sand, "A loaf torn open showing an airy crumb"),
		],
		caption: "Rye and spelt today. The ear on the second one could cut glass.",
		place: "Pan Oduya, Calle Sal",
		ago: 180,
		likes: 2077,
		topics: ["bread"],
		comments: [
			comment("first-loaves", 1, "mara.quint", "Save me the end piece.", 170, 31),
			comment("first-loaves", 2, "bram.rides", "Ride over tomorrow, holding you to this", 150, 4),
		],
	},
	{
		id: "granite-line",
		author: "kai.on.rock",
		frame: "portrait",
		photos: [
			photo("peaks", 13, PALETTES.alpine, "A granite ridge under a cold blue sky"),
			photo("peaks", 21, PALETTES.dusk, "The same ridge at sunset, warm on the west faces"),
			photo("road", 6, PALETTES.alpine, "The approach path winding up through scree"),
			photo("peaks", 2, PALETTES.night, "Stars above the ridge line"),
		],
		caption: "Four pitches, one frozen thumb, zero regrets. Swipe for the walk-out.",
		place: "Aiguille Grise",
		exposure: "f/8 · 1/500 · ISO 200",
		ago: 300,
		likes: 4410,
		topics: ["mountains"],
		comments: [
			comment("granite-line", 1, "teo.lind", "The star one is unreal.", 280, 18),
			comment("granite-line", 2, "ola.surfs", "Frozen thumb club", 240, 7),
			comment("granite-line", 3, ME_HANDLE, "Need the beta for pitch three", 200, 2),
		],
	},
	{
		id: "stair-light",
		author: "noor.builds",
		frame: "portrait",
		photos: [
			photo(
				"arch",
				8,
				PALETTES.plaster,
				"Afternoon light falling through an arched window onto a stair",
			),
		],
		caption: "4:10pm is when this stairwell earns its keep.",
		place: "Casa del Patio",
		exposure: "f/5.6 · 1/60 · ISO 800",
		ago: 420,
		likes: 6022,
		topics: ["architecture"],
		comments: [
			comment("stair-light", 1, "yuki.tiles", "I would paint this every day", 400, 22),
			comment("stair-light", 2, "lio.on.film", "That shadow line", 380, 5),
		],
	},
	{
		id: "night-tram",
		author: "lio.on.film",
		frame: "square",
		photos: [
			photo("city", 4, PALETTES.night, "Lit windows of apartment blocks against a violet night"),
			photo("city", 17, PALETTES.ember, "A street corner under an orange lamp"),
		],
		caption: "Last tram home, last two frames on the roll.",
		place: "Old Town",
		exposure: "f/2 · 1/30 · 800T",
		ago: 600,
		likes: 1543,
		topics: ["night"],
		comments: [comment("night-tram", 1, "noor.builds", "The windows like a calendar", 590, 8)],
	},
	{
		id: "fern-week",
		author: "sana.grows",
		frame: "square",
		photos: [
			photo("ferns", 3, PALETTES.moss, "Fern fronds unfurling in shade"),
			photo("ferns", 12, PALETTES.moss, "A close crop of a single fiddlehead"),
		],
		caption:
			"Fiddlehead week on 14B. They go from question mark to exclamation mark in about four days.",
		place: "Allotment 14B",
		ago: 900,
		likes: 812,
		topics: ["plants"],
		tagged: ["mara.quint"],
		comments: [
			comment("fern-week", 1, "mara.quint", "question mark to exclamation mark 😭", 880, 14),
			comment("fern-week", 2, "ines.bakes", "Bring some to the shop?", 860, 2),
		],
	},
	{
		id: "tile-study",
		author: "yuki.tiles",
		frame: "square",
		photos: [
			photo("tiles", 1, PALETTES.tile, "A grid of blue and ochre painted tiles"),
			photo("tiles", 8, PALETTES.clay, "A terracotta version of the same pattern"),
			photo("tiles", 15, PALETTES.sea, "Pale blue tiles with white stars"),
		],
		caption: "Same pattern, three glazes. Which one goes in the kitchen?",
		ago: 1300,
		likes: 2390,
		topics: ["pattern", "ceramics"],
		comments: [
			comment("tile-study", 1, "noor.builds", "The first. Always the first.", 1290, 30),
			comment("tile-study", 2, "mara.quint", "Terracotta or nothing", 1280, 27),
			comment("tile-study", 3, ME_HANDLE, "Third, for the sea", 1200, 5),
		],
	},
	{
		id: "gravel-loop",
		author: "bram.rides",
		frame: "portrait",
		photos: [
			photo("road", 2, PALETTES.asphalt, "A gravel road curving between fields toward hills"),
		],
		caption: "92km, one puncture, three cafes. The wind was wrong in both directions somehow.",
		place: "Polder loop",
		ago: 1500,
		likes: 640,
		topics: [],
		comments: [
			comment("gravel-loop", 1, "kai.on.rock", "Wind physics on gravel is a myth", 1490, 3),
		],
	},
	{
		id: "cold-swell",
		author: "ola.surfs",
		frame: "portrait",
		photos: [
			photo("waves", 5, PALETTES.surf, "A clean wave peeling left under grey sky"),
			photo("waves", 14, PALETTES.sea, "Whitewater over a rocky point"),
		],
		caption: "Seven degrees, five millimetres of neoprene, zero people out.",
		place: "Skerry Point",
		exposure: "f/5.6 · 1/1600 · ISO 400",
		ago: 2000,
		likes: 1870,
		topics: ["sea"],
		comments: [comment("cold-swell", 1, "teo.lind", "You are not well. Love it.", 1990, 11)],
	},
	{
		id: "dune-walk",
		author: ME_HANDLE,
		frame: "square",
		photos: [
			photo("dunes", 4, PALETTES.sand, "Wind-ribbed dunes under a low sun"),
			photo("dunes", 19, PALETTES.dusk, "The same dunes at dusk, pink and violet"),
		],
		caption: "Walked out before the wind did. Sand in every pocket for a week.",
		place: "Playa Larga",
		exposure: "f/8 · 1/250 · ISO 100",
		ago: 2600,
		likes: 214,
		topics: [],
		comments: [
			comment("dune-walk", 1, "teo.lind", "The ribs in the first frame!", 2590, 4),
			comment("dune-walk", 2, "noor.builds", "Nature doing architecture", 2500, 6),
		],
	},
	{
		id: "studio-shelf",
		author: "mara.quint",
		frame: "square",
		photos: [
			photo("still-life", 9, PALETTES.plaster, "Unglazed pots drying on a shelf by a window"),
		],
		caption: "Leather-hard and waiting. Studio is open Saturday, come say hi.",
		place: "Quint Clay Studio",
		ago: 3000,
		likes: 2650,
		topics: ["ceramics"],
		comments: [comment("studio-shelf", 1, ME_HANDLE, "Coming with croissants", 2990, 9)],
	},
	{
		id: "harbor-blue",
		author: ME_HANDLE,
		frame: "portrait",
		photos: [photo("harbor", 15, PALETTES.dusk, "A harbour at blue hour with lit boats")],
		caption: "Blue hour, borrowed tripod, cold hands.",
		place: "Nordhamn",
		ago: 4300,
		likes: 188,
		topics: ["sea", "night"],
		tagged: ["teo.lind"],
		comments: [comment("harbor-blue", 1, "teo.lind", "Told you the tripod was worth it", 4290, 3)],
	},
	{
		id: "courtyard",
		author: "noor.builds",
		frame: "square",
		photos: [
			photo("arch", 2, PALETTES.clay, "A row of terracotta arches around a courtyard"),
			photo("tiles", 4, PALETTES.plaster, "Worn floor tiles in the courtyard"),
		],
		caption: "Courtyards are just rooms with the sky for a ceiling.",
		ago: 5200,
		likes: 3900,
		topics: ["architecture", "pattern"],
		comments: [],
	},
	{
		id: "night-bakery",
		author: "ines.bakes",
		frame: "square",
		photos: [photo("city", 9, PALETTES.night, "A bakery window glowing on a dark street")],
		caption: "4am view from the oven door.",
		place: "Pan Oduya, Calle Sal",
		ago: 6000,
		likes: 1777,
		topics: ["bread", "night"],
		comments: [comment("night-bakery", 1, "lio.on.film", "Coming to shoot this", 5990, 2)],
	},
	{
		id: "bread-and-bowls",
		author: ME_HANDLE,
		frame: "square",
		photos: [
			photo("still-life", 14, PALETTES.crust, "A loaf on a ceramic plate with a bowl of olives"),
		],
		caption: "Inès's bread, Mara's plate. Lunch is a collaboration.",
		ago: 8200,
		likes: 302,
		topics: ["bread", "ceramics"],
		tagged: ["ines.bakes", "mara.quint"],
		comments: [comment("bread-and-bowls", 1, "mara.quint", "The plate looks happy", 8190, 5)],
	},
	{
		id: "summit-dawn",
		author: "kai.on.rock",
		frame: "square",
		photos: [photo("peaks", 30, PALETTES.ember, "Peaks lit red at dawn")],
		caption: "Alpine start pays rent.",
		ago: 9000,
		likes: 5104,
		topics: ["mountains"],
		comments: [],
	},
	{
		id: "fern-shadow",
		author: "sana.grows",
		frame: "portrait",
		photos: [photo("ferns", 22, PALETTES.night, "Fern silhouettes against a dusk sky")],
		caption: "Watering at dusk, accidentally made an album cover.",
		ago: 11000,
		likes: 690,
		topics: ["plants", "night"],
		comments: [],
	},
];

/** Every reel, in the order the Reels tab plays them. */
export const REELS: Reel[] = [
	{
		id: "throwing-a-moon-jar",
		author: "mara.quint",
		caption: "Throwing the two halves of a moon jar. The join is the whole trick.",
		sound: "Wheel hum · original audio",
		scene: photo("bowls", 31, PALETTES.clay, "Clay spinning on a wheel"),
		seconds: 28,
		clip: 22,
		likes: 18400,
		comments: 312,
		ago: 120,
	},
	{
		id: "fog-timelapse",
		author: "teo.lind",
		caption: "Ninety minutes of harbour fog in twenty seconds.",
		sound: "Teo Lindqvist · Low tide",
		scene: photo("harbor", 41, PALETTES.sea, "Fog drifting across a harbour"),
		seconds: 20,
		clip: 23,
		likes: 6210,
		comments: 88,
		ago: 260,
	},
	{
		id: "scoring-loaves",
		author: "ines.bakes",
		caption: "Scoring, one cut each, no second chances.",
		sound: "Oven fan · original audio",
		scene: photo("loaves", 12, PALETTES.crust, "A blade scoring dough"),
		seconds: 15,
		clip: 24,
		likes: 22900,
		comments: 540,
		ago: 480,
	},
	{
		id: "ridge-walk",
		author: "kai.on.rock",
		caption: "The walk-out from Aiguille Grise, sped up so your knees don't hurt.",
		sound: "Wind · original audio",
		scene: photo("peaks", 44, PALETTES.alpine, "Walking a ridge above clouds"),
		seconds: 24,
		clip: 25,
		likes: 9870,
		comments: 140,
		ago: 900,
	},
	{
		id: "painting-a-tile",
		author: "yuki.tiles",
		caption: "One tile, four brushes, ten minutes. Real time was forty.",
		sound: "Yuki Tanabe · Studio radio",
		scene: photo("tiles", 23, PALETTES.tile, "Brush strokes on a white tile"),
		seconds: 18,
		clip: 26,
		likes: 14300,
		comments: 205,
		ago: 1400,
	},
	{
		id: "seven-degree-session",
		author: "ola.surfs",
		caption: "POV: it is seven degrees and you chose this.",
		sound: "Ola Brenner · Paddle out",
		scene: photo("waves", 33, PALETTES.surf, "Riding a cold green wave"),
		seconds: 22,
		clip: 27,
		likes: 7720,
		comments: 96,
		ago: 2200,
	},
	{
		id: "night-walk",
		author: "lio.on.film",
		caption: "Loading a roll of 800T under a streetlamp and walking until it's gone.",
		sound: "City hum · original audio",
		scene: photo("city", 50, PALETTES.night, "Night street with passing lights"),
		seconds: 26,
		clip: 28,
		likes: 5230,
		comments: 61,
		ago: 3100,
	},
];

/** A segment of a still photograph, five seconds long. */
function still(
	scene: Scene,
	seed: number,
	palette: Photo["palette"],
	alt: string,
	ago: number,
	sticker?: string,
): StorySegment {
	return { photo: photo(scene, seed, palette, alt), ago, sticker };
}

/** Today's stories, in the order the tray lists them after the visitor's own. */
export const STORIES: Story[] = [
	{
		author: "mara.quint",
		seen: false,
		segments: [
			still(
				"bowls",
				61,
				PALETTES.ember,
				"Kiln glowing at peak temperature",
				300,
				"1280°C and holding",
			),
			{
				photo: photo("bowls", 62, PALETTES.clay, "Hands trimming a bowl on the wheel"),
				clip: { minutes: 29, seconds: 8 },
				ago: 200,
				sticker: "trimming day",
			},
			still("still-life", 63, PALETTES.clay, "A row of finished cups", 90),
		],
	},
	{
		author: "teo.lind",
		seen: false,
		segments: [
			still("harbor", 71, PALETTES.sea, "Harbour at first light", 400, "06:12"),
			still("waves", 72, PALETTES.surf, "Spray over the breakwater", 380),
		],
	},
	{
		author: "ines.bakes",
		seen: false,
		segments: [
			{
				photo: photo("loaves", 81, PALETTES.crust, "Loaves going into the oven"),
				clip: { minutes: 31, seconds: 6 },
				ago: 500,
				sticker: "first bake ✶",
			},
			still("loaves", 82, PALETTES.sand, "Cooling rack full of bread", 470, "sold out by 10"),
		],
	},
	{
		author: "yuki.tiles",
		seen: false,
		segments: [still("tiles", 91, PALETTES.tile, "A half-painted tile on a desk", 700, "WIP")],
	},
	{
		author: "kai.on.rock",
		seen: true,
		segments: [
			still("peaks", 101, PALETTES.alpine, "Ridge from the hut window", 900),
			still("road", 102, PALETTES.alpine, "Boots on scree", 880, "approach #2"),
		],
	},
	{
		author: "lio.on.film",
		seen: true,
		segments: [still("city", 111, PALETTES.night, "Neon reflections in a puddle", 1100, "800T")],
	},
	{
		author: "bram.rides",
		seen: true,
		segments: [
			still(
				"road",
				121,
				PALETTES.asphalt,
				"A cafe stop with a bike leaning on the wall",
				1200,
				"cafe #3",
			),
		],
	},
];

/** Every profile's highlights. */
export const HIGHLIGHTS: Highlight[] = [
	{
		id: "firings",
		author: "mara.quint",
		title: "Firings",
		cover: photo("bowls", 201, PALETTES.ember, "Kiln"),
		segments: [
			still("bowls", 202, PALETTES.ember, "Kiln at night", 20000, "firing #41"),
			still("bowls", 203, PALETTES.clay, "Bowls after firing", 19000),
		],
	},
	{
		id: "studio",
		author: "mara.quint",
		title: "Studio",
		cover: photo("still-life", 204, PALETTES.plaster, "Studio shelf"),
		segments: [
			still("still-life", 205, PALETTES.plaster, "Studio shelf with pots", 30000, "open Sat"),
		],
	},
	{
		id: "glazes",
		author: "mara.quint",
		title: "Glazes",
		cover: photo("tiles", 206, PALETTES.moss, "Glaze test tiles"),
		segments: [
			still("tiles", 207, PALETTES.moss, "Glaze test tiles in a grid", 40000, "ash + iron"),
			still("tiles", 208, PALETTES.clay, "More glaze tests", 39000),
		],
	},
	{
		id: "harbors",
		author: ME_HANDLE,
		title: "Harbours",
		cover: photo("harbor", 211, PALETTES.sea, "Harbour"),
		segments: [
			still("harbor", 212, PALETTES.sea, "Moored boats", 30000),
			still("harbor", 213, PALETTES.dusk, "Harbour at dusk", 29000, "blue hour"),
		],
	},
	{
		id: "bread",
		author: ME_HANDLE,
		title: "Bread",
		cover: photo("loaves", 214, PALETTES.crust, "Loaf"),
		segments: [still("loaves", 215, PALETTES.crust, "A loaf on a board", 25000, "Inès ✶")],
	},
	{
		id: "dunes",
		author: ME_HANDLE,
		title: "Dunes",
		cover: photo("dunes", 216, PALETTES.sand, "Dunes"),
		segments: [still("dunes", 217, PALETTES.sand, "Dunes at noon", 26000)],
	},
	{
		id: "boats",
		author: "teo.lind",
		title: "Boats",
		cover: photo("harbor", 221, PALETTES.sea, "Boat"),
		segments: [still("harbor", 222, PALETTES.sea, "A small sailboat", 50000, "Freja")],
	},
	{
		id: "ovens",
		author: "ines.bakes",
		title: "Ovens",
		cover: photo("loaves", 231, PALETTES.ember, "Oven"),
		segments: [still("loaves", 232, PALETTES.ember, "Bread in a glowing oven", 60000)],
	},
	{
		id: "routes",
		author: "kai.on.rock",
		title: "Routes",
		cover: photo("peaks", 241, PALETTES.alpine, "Peak"),
		segments: [still("peaks", 242, PALETTES.alpine, "A ridge route", 70000, "4 pitches")],
	},
];

/**
 * Finds a person by handle.
 *
 * @param handle The handle as an address carries it.
 */
export function findPerson(handle: string): Person | undefined {
	return PEOPLE.find((person) => person.handle === handle);
}

/** The visitor. */
export const ME: Person = findPerson(ME_HANDLE)!;

/**
 * Finds a post by id.
 *
 * @param id The id as an address carries it.
 */
export function findPost(id: string): Post | undefined {
	return POSTS.find((post) => post.id === id);
}

/**
 * Finds a reel by id.
 *
 * @param id The id as an address carries it.
 */
export function findReel(id: string): Reel | undefined {
	return REELS.find((reel) => reel.id === id);
}

/** The story a person posted today, if any. */
export function storyOf(handle: string): Story | undefined {
	return STORIES.find((story) => story.author === handle);
}

/** A person's highlights, in the order their profile shows them. */
export function highlightsOf(handle: string): Highlight[] {
	return HIGHLIGHTS.filter((highlight) => highlight.author === handle);
}

/** Finds a highlight by its owner and id. */
export function findHighlight(handle: string, id: string): Highlight | undefined {
	return HIGHLIGHTS.find((highlight) => highlight.author === handle && highlight.id === id);
}

/** A person's own posts, newest first. */
export function postsBy(handle: string): Post[] {
	return POSTS.filter((post) => post.author === handle);
}

/** The posts a person is tagged in, newest first. */
export function postsTagging(handle: string): Post[] {
	return POSTS.filter((post) => post.tagged?.includes(handle));
}

/** A person's reels. */
export function reelsBy(handle: string): Reel[] {
	return REELS.filter((reel) => reel.author === handle);
}

/**
 * The posts Explore shows for a search or a topic: a query matches a caption, a place, an
 * author's name or handle, and a topic's name; a topic narrows to the posts filed under it.
 *
 * @param query What the visitor typed; blank for none.
 * @param topic A topic id; `undefined` for every topic.
 */
export function explorePosts(query: string, topic: string | undefined): Post[] {
	let needle = query.trim().toLowerCase();
	return POSTS.filter((post) => {
		if (topic !== undefined && !post.topics.includes(topic)) return false;
		if (needle === "") return true;
		let author = findPerson(post.author);
		let haystack = [
			post.caption,
			post.place ?? "",
			author?.name ?? "",
			post.author,
			...post.topics.map((id) => TOPICS.find((entry) => entry.id === id)?.name ?? ""),
		]
			.join(" ")
			.toLowerCase();
		return haystack.includes(needle);
	});
}

/**
 * The people a search finds by name or handle.
 *
 * @param query What the visitor typed.
 */
export function searchPeople(query: string): Person[] {
	let needle = query.trim().toLowerCase();
	if (needle === "") return [];
	return PEOPLE.filter(
		(person) =>
			person.handle !== ME_HANDLE &&
			(person.name.toLowerCase().includes(needle) || person.handle.includes(needle)),
	);
}

/**
 * How long ago something happened, the short way a feed reads it.
 *
 * @param minutes Minutes before {@link NOW}.
 * @example shortAge(95) // "1h"
 */
export function shortAge(minutes: number): string {
	if (minutes < 1) return "now";
	if (minutes < 60) return `${Math.floor(minutes)}m`;
	if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
	if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / (60 * 24))}d`;
	return `${Math.floor(minutes / (60 * 24 * 7))}w`;
}

/**
 * A count the way a feed abbreviates it.
 *
 * @example compact(48200) // "48.2K"
 */
export function compact(count: number): string {
	if (count < 10_000) return count.toLocaleString("en-US");
	if (count < 1_000_000)
		return `${(count / 1000).toFixed(count < 100_000 ? 1 : 0).replace(/\.0$/, "")}K`;
	return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
