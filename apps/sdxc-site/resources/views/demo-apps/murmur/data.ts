/**
 * Murmur's catalogue: invented artists, their albums and tracks, the editorial and personal
 * playlists, and the genres search files them under. Every track's sound is written by the
 * synthesizer from the numbers here; no name, cover or note belongs to a real recording.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Mode, SongSpec, Style } from "@sdxc/synth";

import { demoAppActionHref, demoAppHref } from "~/resources/views/demo-apps";

/**
 * The sample rate every track renders at: a quarter of CD quality keeps a rendered track a few
 * megabytes in memory, and these timbres lose nothing at it.
 */
export const SONG_SAMPLE_RATE = 22_050;

/** The folder name the app is served under. */
export const SLUG = "murmur";

/** The address of a Murmur screen. */
export const href = demoAppHref(SLUG);

/** The address a Murmur form posts to. */
export const actionHref = demoAppActionHref(SLUG);

/** The drawing a cover is made of, each an original composition. */
export type Motif =
	| "orbit"
	| "bands"
	| "grid"
	| "waves"
	| "blocks"
	| "rain"
	| "horizon"
	| "petals"
	| "rings"
	| "stripes";

/** A cover's three inks: the ground, the main shape and a spark. */
export interface CoverPalette {
	ground: string;
	shape: string;
	spark: string;
}

/** A person or band on Murmur. */
export interface Artist {
	id: string;
	name: string;
	/** One line on who they are, under the name on their page. */
	bio: string;
	/** Listeners this month, the figure an artist page leads with. */
	listeners: number;
	/** The hue their portrait and page header are drawn in. */
	hue: number;
	/** Genres their music files under. */
	genres: string[];
	/** Related artists, for "Fans also like". */
	related: string[];
}

/** A track on an album, with everything the synthesizer needs to write its sound. */
export interface Track {
	id: string;
	title: string;
	/** Album id. */
	album: string;
	/** Artist ids, the album's artist first. */
	artists: string[];
	/** Length in seconds. */
	duration: number;
	explicit?: boolean;
	/** Plays all time, for an artist's popular tracks. */
	plays: number;
}

/** An album, an EP or a single. */
export interface Album {
	id: string;
	title: string;
	artist: string;
	kind: "Album" | "EP" | "Single";
	year: number;
	/** The style and key every track on it is written in. */
	style: Style;
	key: number;
	mode: Mode;
	motif: Motif;
	palette: CoverPalette;
	genres: string[];
	/** The label line under the track table. */
	label: string;
	/** The release date line under the track table. */
	released: string;
	tracks: Track[];
}

/** A playlist: Murmur's own editorial ones, or the listener's. */
export interface Playlist {
	id: string;
	title: string;
	description: string;
	/** "Murmur" for editorial playlists, the listener's name for their own. */
	owner: string;
	/** Whether the listener made it, which files it under "Your playlists". */
	mine: boolean;
	motif: Motif;
	palette: CoverPalette;
	genres: string[];
	/** Track ids in order. */
	tracks: string[];
	/** Days ago each track was added, in the same order, for the "Date added" column. */
	added: number[];
	saves: number;
}

/** A tile on the search page and the page it opens. */
export interface Genre {
	id: string;
	name: string;
	/** The tile's color, an `oklch()` value. */
	color: string;
	motif: Motif;
}

/** The listener the demo signs in as. */
export const LISTENER = { name: "Rowan", initials: "R" } as const;

/** Every artist, in no particular order. */
export const ARTISTS: Artist[] = [
	{
		id: "lumen-harbor",
		name: "Lumen Harbor",
		bio: "Slow-moving synth tides recorded at the edge of a fishing town.",
		listeners: 1_284_310,
		hue: 220,
		genres: ["ambient", "focus", "sleep"],
		related: ["odile-varga", "slow-meridian", "velvet-cartography"],
	},
	{
		id: "juniper-static",
		name: "Juniper Static",
		bio: "Dusty keys and soft drums for the hour after the rain stops.",
		listeners: 2_906_455,
		hue: 140,
		genres: ["lofi", "focus", "chill"],
		related: ["saffron-tapes", "slow-meridian", "lumen-harbor"],
	},
	{
		id: "neon-orchard",
		name: "Neon Orchard",
		bio: "A duo writing bright, bittersweet synthpop about late trains and early mornings.",
		listeners: 4_517_002,
		hue: 330,
		genres: ["synthpop", "night", "party"],
		related: ["night-ferry", "velvet-cartography", "juniper-static"],
	},
	{
		id: "odile-varga",
		name: "Odile Varga",
		bio: "Composer scoring imaginary films for strings, synths and room tone.",
		listeners: 862_190,
		hue: 30,
		genres: ["cinematic", "focus"],
		related: ["lumen-harbor", "slow-meridian", "velvet-cartography"],
	},
	{
		id: "slow-meridian",
		name: "Slow Meridian",
		bio: "Downtempo grooves built from field recordings and a borrowed drum machine.",
		listeners: 1_740_088,
		hue: 75,
		genres: ["downtempo", "chill", "night"],
		related: ["juniper-static", "odile-varga", "night-ferry"],
	},
	{
		id: "night-ferry",
		name: "Night Ferry",
		bio: "Warm, rolling house for the last crossing of the evening.",
		listeners: 3_302_514,
		hue: 260,
		genres: ["house", "party", "workout"],
		related: ["neon-orchard", "slow-meridian", "saffron-tapes"],
	},
	{
		id: "saffron-tapes",
		name: "Saffron Tapes",
		bio: "Bedroom producer collecting beats on a cassette four-track.",
		listeners: 1_031_967,
		hue: 55,
		genres: ["lofi", "chill", "morning"],
		related: ["juniper-static", "night-ferry", "slow-meridian"],
	},
	{
		id: "velvet-cartography",
		name: "Velvet Cartography",
		bio: "Synth-driven songs that map the places between sleep and waking.",
		listeners: 2_215_640,
		hue: 290,
		genres: ["synthpop", "downtempo", "night"],
		related: ["neon-orchard", "lumen-harbor", "odile-varga"],
	},
];

/** One track's title and length as written in an album's listing. */
type Listing = [title: string, minutes: number, seconds: number, explicit?: boolean];

/** The facts an album is written with, before its tracks get ids and plays. */
type AlbumDraft = Omit<Album, "tracks"> & {
	listing: Listing[];
	featuring?: Record<number, string>;
};

/**
 * Turns an album's listing into tracks with ids, lengths and play counts, the counts falling
 * off after the first singles the way a real album's do.
 */
function album(draft: AlbumDraft): Album {
	let { featuring = {}, listing, ...rest } = draft;
	let tracks = listing.map(([title, minutes, seconds, explicit], index) => ({
		id: `${draft.id}-${index + 1}`,
		title,
		album: draft.id,
		artists: featuring[index] === undefined ? [draft.artist] : [draft.artist, featuring[index]],
		duration: minutes * 60 + seconds,
		explicit,
		plays: Math.round(
			(48_000_000 / (index + 1.6)) * (((draft.title.length * 7 + index * 13) % 9) + 3) * 0.1,
		),
	}));
	return { ...rest, tracks };
}

/** Every album, newest first within each artist. */
export const ALBUMS: Album[] = [
	album({
		id: "tidelight",
		title: "Tidelight",
		artist: "lumen-harbor",
		kind: "Album",
		year: 2025,
		style: "ambient",
		key: 48,
		mode: "lydian",
		motif: "horizon",
		palette: {
			ground: "oklch(0.32 0.08 240)",
			shape: "oklch(0.86 0.09 80)",
			spark: "oklch(0.7 0.12 220)",
		},
		genres: ["ambient", "sleep", "focus"],
		label: "Shoreline Recordings",
		released: "March 14, 2025",
		listing: [
			["First Light on the Breakwater", 3, 42],
			["Salt Glass", 2, 58],
			["Harbor Bells", 4, 6],
			["The Long Pier", 3, 21],
			["Kelp Forest Lullaby", 3, 47],
			["Low Tide, High Sky", 2, 49],
			["Lanterns Out", 4, 18],
		],
		featuring: { 3: "odile-varga" },
	}),
	album({
		id: "low-orbit-lullabies",
		title: "Low Orbit Lullabies",
		artist: "lumen-harbor",
		kind: "EP",
		year: 2023,
		style: "ambient",
		key: 45,
		mode: "major",
		motif: "orbit",
		palette: {
			ground: "oklch(0.2 0.04 270)",
			shape: "oklch(0.78 0.08 250)",
			spark: "oklch(0.88 0.12 90)",
		},
		genres: ["ambient", "sleep"],
		label: "Shoreline Recordings",
		released: "October 2, 2023",
		listing: [
			["Satellite Hum", 3, 12],
			["Perigee", 2, 44],
			["Moonlit Telemetry", 3, 30],
			["Soft Reentry", 3, 5],
		],
	}),
	album({
		id: "rainy-window-sessions",
		title: "Rainy Window Sessions",
		artist: "juniper-static",
		kind: "Album",
		year: 2024,
		style: "lofi",
		key: 45,
		mode: "dorian",
		motif: "rain",
		palette: {
			ground: "oklch(0.42 0.05 160)",
			shape: "oklch(0.9 0.04 120)",
			spark: "oklch(0.75 0.13 60)",
		},
		genres: ["lofi", "focus", "chill"],
		label: "Fernleaf Tapes",
		released: "November 8, 2024",
		listing: [
			["Condensation", 2, 31],
			["Umbrella Stand", 2, 47],
			["Tram Window", 2, 22],
			["Tea Gone Cold", 3, 4],
			["Puddle Jump", 2, 15],
			["Streetlight Haze", 2, 56],
			["Wool Socks", 2, 39],
			["After the Downpour", 3, 11],
		],
		featuring: { 4: "saffron-tapes" },
	}),
	album({
		id: "midnight-citrus",
		title: "Midnight Citrus",
		artist: "neon-orchard",
		kind: "Album",
		year: 2026,
		style: "synthpop",
		key: 43,
		mode: "minor",
		motif: "petals",
		palette: {
			ground: "oklch(0.3 0.12 320)",
			shape: "oklch(0.8 0.17 60)",
			spark: "oklch(0.72 0.2 350)",
		},
		genres: ["synthpop", "night", "party"],
		label: "Grove Electric",
		released: "September 19, 2026",
		listing: [
			["Peel Back the Night", 3, 38],
			["Orange Streetlights", 3, 14, true],
			["Last Train Bloom", 4, 2],
			["Zest", 2, 55],
			["Sugar & Static", 3, 27],
			["Grove at 2AM", 3, 49, true],
			["Pith", 3, 3],
			["Ripen", 4, 21],
		],
		featuring: { 4: "velvet-cartography" },
	}),
	album({
		id: "static-bloom",
		title: "Static Bloom",
		artist: "neon-orchard",
		kind: "Single",
		year: 2025,
		style: "synthpop",
		key: 41,
		mode: "mixolydian",
		motif: "rings",
		palette: {
			ground: "oklch(0.88 0.06 330)",
			shape: "oklch(0.45 0.18 330)",
			spark: "oklch(0.7 0.15 30)",
		},
		genres: ["synthpop", "morning"],
		label: "Grove Electric",
		released: "May 30, 2025",
		listing: [
			["Static Bloom", 3, 33],
			["Static Bloom (Night Ferry Remix)", 4, 12],
		],
		featuring: { 1: "night-ferry" },
	}),
	album({
		id: "atlas-of-small-hours",
		title: "Atlas of Small Hours",
		artist: "odile-varga",
		kind: "Album",
		year: 2025,
		style: "cinematic",
		key: 40,
		mode: "minor",
		motif: "grid",
		palette: {
			ground: "oklch(0.93 0.02 80)",
			shape: "oklch(0.3 0.03 60)",
			spark: "oklch(0.62 0.17 35)",
		},
		genres: ["cinematic", "focus"],
		label: "Meridian Classics",
		released: "January 24, 2025",
		listing: [
			["Prologue: 3:12 AM", 2, 41],
			["Cartographer's Desk", 4, 7],
			["The Unlit Corridor", 3, 36],
			["Atlas", 4, 44],
			["Ink on Vellum", 3, 2],
			["Dawn Survey", 3, 58],
		],
	}),
	album({
		id: "hinterland",
		title: "Hinterland",
		artist: "slow-meridian",
		kind: "Album",
		year: 2024,
		style: "downtempo",
		key: 44,
		mode: "mixolydian",
		motif: "bands",
		palette: {
			ground: "oklch(0.55 0.11 60)",
			shape: "oklch(0.3 0.06 40)",
			spark: "oklch(0.92 0.07 90)",
		},
		genres: ["downtempo", "chill"],
		label: "Long Road Audio",
		released: "July 12, 2024",
		listing: [
			["Dust Road", 3, 51],
			["Grain Silo", 4, 9],
			["Cicada Hour", 3, 28],
			["Telegraph Lines", 3, 43],
			["Heat Mirage", 4, 15],
			["County Fair Lights", 3, 36, true],
			["Homeward", 4, 2],
		],
		featuring: { 2: "juniper-static" },
	}),
	album({
		id: "harbor-lights",
		title: "Harbor Lights",
		artist: "night-ferry",
		kind: "Album",
		year: 2026,
		style: "house",
		key: 41,
		mode: "minor",
		motif: "stripes",
		palette: {
			ground: "oklch(0.22 0.07 265)",
			shape: "oklch(0.7 0.15 200)",
			spark: "oklch(0.85 0.16 120)",
		},
		genres: ["house", "party", "workout"],
		label: "Gangway Records",
		released: "June 5, 2026",
		listing: [
			["Last Crossing", 4, 31],
			["Deck Lights", 3, 58],
			["Wake Pattern", 4, 22],
			["Portside", 3, 46, true],
			["Foghorn Disco", 4, 5],
			["Mooring", 3, 39],
		],
		featuring: { 4: "neon-orchard" },
	}),
	album({
		id: "tea-for-the-tape-deck",
		title: "Tea for the Tape Deck",
		artist: "saffron-tapes",
		kind: "Album",
		year: 2023,
		style: "lofi",
		key: 46,
		mode: "major",
		motif: "blocks",
		palette: {
			ground: "oklch(0.82 0.1 75)",
			shape: "oklch(0.5 0.13 30)",
			spark: "oklch(0.35 0.06 250)",
		},
		genres: ["lofi", "morning", "chill"],
		label: "Four-Track Club",
		released: "April 21, 2023",
		listing: [
			["Kettle Click", 2, 18],
			["Rewind Button", 2, 41],
			["Sunday Paper", 2, 27],
			["Chipped Mug", 2, 54],
			["Side B", 2, 36],
			["Window Box Basil", 3, 2],
		],
	}),
	album({
		id: "maps-in-the-dark",
		title: "Maps in the Dark",
		artist: "velvet-cartography",
		kind: "Album",
		year: 2025,
		style: "downtempo",
		key: 42,
		mode: "minor",
		motif: "waves",
		palette: {
			ground: "oklch(0.25 0.09 300)",
			shape: "oklch(0.7 0.14 300)",
			spark: "oklch(0.86 0.1 190)",
		},
		genres: ["synthpop", "downtempo", "night"],
		label: "Contour Music",
		released: "August 29, 2025",
		listing: [
			["Contour Lines", 3, 47],
			["You Are Here", 3, 21],
			["Legend (Key to the Map)", 4, 4],
			["Scale 1:1", 3, 35, true],
			["Isobars", 3, 52],
			["North Is Wherever You Face", 4, 26],
		],
		featuring: { 1: "neon-orchard" },
	}),
];

/** Every track on every album, in album order. */
export const TRACKS: Track[] = ALBUMS.flatMap((entry) => entry.tracks);

/** Picks tracks by `album:number`, so playlists read like a crate of records. */
function pick(...refs: string[]): string[] {
	return refs.map((ref) => {
		let [albumId = "", number = "1"] = ref.split(":");
		return `${albumId}-${number}`;
	});
}

/** Murmur's editorial playlists and the listener's own. */
export const PLAYLISTS: Playlist[] = [
	{
		id: "heads-down",
		title: "Heads Down",
		description: "Keep calm and get it done. Wordless, steady, kind to your attention.",
		owner: "Murmur",
		mine: false,
		motif: "grid",
		palette: {
			ground: "oklch(0.3 0.05 200)",
			shape: "oklch(0.86 0.06 180)",
			spark: "oklch(0.75 0.12 80)",
		},
		genres: ["focus", "ambient", "cinematic"],
		tracks: pick(
			"tidelight:2",
			"atlas-of-small-hours:2",
			"rainy-window-sessions:4",
			"low-orbit-lullabies:3",
			"atlas-of-small-hours:5",
			"tidelight:4",
			"rainy-window-sessions:1",
			"hinterland:3",
			"tidelight:6",
			"atlas-of-small-hours:6",
		),
		added: [2, 2, 5, 9, 9, 12, 20, 21, 30, 41],
		saves: 2_104_877,
	},
	{
		id: "night-drive",
		title: "Night Drive",
		description: "Synths, streetlights and the long way home.",
		owner: "Murmur",
		mine: false,
		motif: "stripes",
		palette: {
			ground: "oklch(0.18 0.05 280)",
			shape: "oklch(0.72 0.18 330)",
			spark: "oklch(0.8 0.14 200)",
		},
		genres: ["night", "synthpop"],
		tracks: pick(
			"midnight-citrus:3",
			"maps-in-the-dark:1",
			"harbor-lights:1",
			"midnight-citrus:2",
			"maps-in-the-dark:4",
			"static-bloom:1",
			"harbor-lights:6",
			"hinterland:6",
			"midnight-citrus:6",
		),
		added: [1, 1, 3, 6, 6, 10, 14, 22, 35],
		saves: 1_388_201,
	},
	{
		id: "morning-static",
		title: "Morning Static",
		description: "Ease into the day with warm crackle and slow coffee.",
		owner: "Murmur",
		mine: false,
		motif: "horizon",
		palette: {
			ground: "oklch(0.88 0.07 70)",
			shape: "oklch(0.68 0.16 40)",
			spark: "oklch(0.45 0.08 250)",
		},
		genres: ["morning", "lofi", "chill"],
		tracks: pick(
			"tea-for-the-tape-deck:1",
			"rainy-window-sessions:7",
			"static-bloom:1",
			"tea-for-the-tape-deck:3",
			"tidelight:1",
			"tea-for-the-tape-deck:6",
			"rainy-window-sessions:2",
		),
		added: [0, 3, 3, 8, 15, 15, 27],
		saves: 642_330,
	},
	{
		id: "kitchen-dance-floor",
		title: "Kitchen Dance Floor",
		description: "Turn it up while the pasta boils.",
		owner: "Murmur",
		mine: false,
		motif: "blocks",
		palette: {
			ground: "oklch(0.7 0.17 25)",
			shape: "oklch(0.93 0.08 95)",
			spark: "oklch(0.3 0.08 270)",
		},
		genres: ["party", "house", "workout"],
		tracks: pick(
			"harbor-lights:5",
			"midnight-citrus:4",
			"static-bloom:2",
			"harbor-lights:2",
			"midnight-citrus:5",
			"harbor-lights:4",
			"midnight-citrus:1",
			"harbor-lights:3",
		),
		added: [4, 4, 7, 7, 11, 18, 18, 26],
		saves: 908_516,
	},
	{
		id: "sunday-slow",
		title: "Sunday Slow",
		description: "Nowhere to be. Downtempo and dust in the sunlight.",
		owner: "Murmur",
		mine: false,
		motif: "bands",
		palette: {
			ground: "oklch(0.6 0.08 150)",
			shape: "oklch(0.92 0.05 100)",
			spark: "oklch(0.55 0.14 40)",
		},
		genres: ["chill", "downtempo"],
		tracks: pick(
			"hinterland:1",
			"maps-in-the-dark:5",
			"tea-for-the-tape-deck:5",
			"hinterland:7",
			"rainy-window-sessions:8",
			"maps-in-the-dark:6",
			"hinterland:4",
		),
		added: [6, 6, 13, 13, 19, 24, 33],
		saves: 471_092,
	},
	{
		id: "late-train-home",
		title: "Late Train Home",
		description: "For the window seat.",
		owner: LISTENER.name,
		mine: true,
		motif: "waves",
		palette: {
			ground: "oklch(0.35 0.06 230)",
			shape: "oklch(0.82 0.08 230)",
			spark: "oklch(0.8 0.15 70)",
		},
		genres: ["night", "chill"],
		tracks: pick(
			"midnight-citrus:3",
			"rainy-window-sessions:3",
			"maps-in-the-dark:2",
			"tidelight:7",
			"hinterland:5",
			"low-orbit-lullabies:4",
		),
		added: [1, 4, 9, 16, 16, 40],
		saves: 12,
	},
	{
		id: "studio-hours",
		title: "Studio Hours",
		description: "What I put on to draw.",
		owner: LISTENER.name,
		mine: true,
		motif: "petals",
		palette: {
			ground: "oklch(0.9 0.04 300)",
			shape: "oklch(0.5 0.14 290)",
			spark: "oklch(0.72 0.14 150)",
		},
		genres: ["focus", "lofi"],
		tracks: pick(
			"tea-for-the-tape-deck:2",
			"atlas-of-small-hours:4",
			"rainy-window-sessions:6",
			"low-orbit-lullabies:1",
			"tea-for-the-tape-deck:4",
		),
		added: [2, 2, 11, 23, 58],
		saves: 3,
	},
];

/** The tiles on the search page, each opening its genre's page. */
export const GENRES: Genre[] = [
	{ id: "ambient", name: "Ambient", color: "oklch(0.55 0.12 230)", motif: "horizon" },
	{ id: "lofi", name: "Lo-fi", color: "oklch(0.58 0.1 150)", motif: "rain" },
	{ id: "synthpop", name: "Synthpop", color: "oklch(0.58 0.2 340)", motif: "petals" },
	{ id: "house", name: "House", color: "oklch(0.5 0.18 270)", motif: "stripes" },
	{ id: "downtempo", name: "Downtempo", color: "oklch(0.6 0.13 60)", motif: "bands" },
	{ id: "cinematic", name: "Cinematic", color: "oklch(0.45 0.08 40)", motif: "grid" },
	{ id: "focus", name: "Focus", color: "oklch(0.5 0.09 190)", motif: "grid" },
	{ id: "chill", name: "Chill", color: "oklch(0.62 0.11 170)", motif: "waves" },
	{ id: "night", name: "Night", color: "oklch(0.35 0.1 285)", motif: "orbit" },
	{ id: "morning", name: "Morning", color: "oklch(0.7 0.14 70)", motif: "horizon" },
	{ id: "party", name: "Party", color: "oklch(0.6 0.2 25)", motif: "blocks" },
	{ id: "sleep", name: "Sleep", color: "oklch(0.32 0.06 250)", motif: "rings" },
	{ id: "workout", name: "Workout", color: "oklch(0.62 0.19 45)", motif: "stripes" },
];

/** Tracks the listener has liked when they first arrive, most recent first. */
export const DEFAULT_LIKED = pick(
	"midnight-citrus:3",
	"tidelight:3",
	"rainy-window-sessions:4",
	"harbor-lights:1",
	"maps-in-the-dark:2",
	"hinterland:3",
	"static-bloom:1",
	"atlas-of-small-hours:4",
	"tea-for-the-tape-deck:1",
);

/** Albums and editorial playlists in the listener's library when they first arrive. */
export const DEFAULT_SAVED = [
	"album:midnight-citrus",
	"album:tidelight",
	"playlist:heads-down",
	"album:hinterland",
	"playlist:night-drive",
	"album:rainy-window-sessions",
];

/** Artists the listener follows when they first arrive. */
export const DEFAULT_FOLLOWED = ["neon-orchard", "lumen-harbor", "juniper-static", "night-ferry"];

/** Looks an artist up by id. */
export function findArtist(id: string): Artist | undefined {
	return ARTISTS.find((artist) => artist.id === id);
}

/** Looks an album up by id. */
export function findAlbum(id: string): Album | undefined {
	return ALBUMS.find((entry) => entry.id === id);
}

/** Looks a playlist up by id. */
export function findPlaylist(id: string): Playlist | undefined {
	return PLAYLISTS.find((playlist) => playlist.id === id);
}

/** Looks a track up by id. */
export function findTrack(id: string): Track | undefined {
	return TRACKS.find((track) => track.id === id);
}

/** Looks a genre up by id. */
export function findGenre(id: string): Genre | undefined {
	return GENRES.find((genre) => genre.id === id);
}

/** An artist's name, or the id when the catalogue lacks it. */
export function artistName(id: string): string {
	return findArtist(id)?.name ?? id;
}

/** An artist's releases, newest first. */
export function albumsBy(artistId: string): Album[] {
	return ALBUMS.filter((entry) => entry.artist === artistId).sort((a, b) => b.year - a.year);
}

/** An artist's most played tracks, their own and those they feature on. */
export function popularTracks(artistId: string, limit = 5): Track[] {
	return TRACKS.filter((track) => track.artists.includes(artistId))
		.sort((a, b) => b.plays - a.plays)
		.slice(0, limit);
}

/** The tracks a playlist lists, in its order; ids the catalogue lacks are skipped. */
export function playlistTracks(playlist: Playlist): Track[] {
	return playlist.tracks.map(findTrack).filter((track) => track !== undefined);
}

/**
 * The synthesizer's recipe for one track: its album's style, key and mode, its own length,
 * and a seed from its id, so two tracks on one album share a sound but never a tune.
 *
 * @param track The track.
 */
export function songSpec(track: Track): SongSpec {
	let source = findAlbum(track.album);
	let seed = 0;
	for (let char of track.id) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) | 0;
	return {
		seed,
		style: source?.style ?? "lofi",
		key: source?.key ?? 45,
		mode: source?.mode ?? "minor",
		duration: track.duration,
	};
}

/** Groups digits for a count, such as "1,284,310". */
export function formatCount(value: number): string {
	return new Intl.NumberFormat("en-US").format(value);
}

/** Writes days ago as a short date phrase, such as "Today", "3 days ago" or "5 weeks ago". */
export function addedLabel(days: number): string {
	if (days === 0) return "Today";
	if (days === 1) return "Yesterday";
	if (days < 14) return `${days} days ago`;
	return `${Math.round(days / 7)} weeks ago`;
}

/** Matches a search query against tracks, albums, artists and playlists by name. */
export function searchCatalogue(query: string): {
	tracks: Track[];
	albums: Album[];
	artists: Artist[];
	playlists: Playlist[];
} {
	let needle = query.trim().toLowerCase();
	if (needle === "") return { tracks: [], albums: [], artists: [], playlists: [] };
	let hit = (text: string) => text.toLowerCase().includes(needle);
	return {
		tracks: TRACKS.filter(
			(track) => hit(track.title) || track.artists.some((id) => hit(artistName(id))),
		).slice(0, 8),
		albums: ALBUMS.filter((entry) => hit(entry.title) || hit(artistName(entry.artist))),
		artists: ARTISTS.filter((artist) => hit(artist.name) || artist.genres.some(hit)),
		playlists: PLAYLISTS.filter((playlist) => hit(playlist.title) || hit(playlist.description)),
	};
}

/**
 * The tracks a play context names, in the order they play: an album's listing, a playlist's
 * order, an artist's most played, the listener's liked tracks, or one track alone.
 *
 * @param context Such as `album:tidelight`, `artist:night-ferry`, `liked` or `track:<id>`.
 * @param liked The listener's liked track ids, which `liked` plays.
 * @returns The tracks, or none for a context the catalogue lacks.
 */
export function contextTracks(context: string, liked: readonly string[]): Track[] {
	let [kind, id = ""] = context.split(":");
	if (context === "liked") return liked.map(findTrack).filter((track) => track !== undefined);
	if (kind === "album") return findAlbum(id)?.tracks ?? [];
	if (kind === "artist") return popularTracks(id, 10);
	if (kind === "track") return TRACKS.filter((track) => track.id === id);
	let playlist = findPlaylist(id);
	return kind === "playlist" && playlist !== undefined ? playlistTracks(playlist) : [];
}

/**
 * Where a play context lives and what it is called, for the player's "Playing from" line.
 *
 * @param context A play context.
 * @returns Its name and page path, or `undefined` for one the catalogue lacks.
 */
export function contextPlace(context: string): { name: string; page: string } | undefined {
	let [kind, id = ""] = context.split(":");
	if (context === "liked") return { name: "Liked Songs", page: "liked" };
	if (kind === "album") {
		let entry = findAlbum(id);
		return entry === undefined ? undefined : { name: entry.title, page: `album/${entry.id}` };
	}
	if (kind === "playlist") {
		let playlist = findPlaylist(id);
		return playlist === undefined
			? undefined
			: { name: playlist.title, page: `playlist/${playlist.id}` };
	}
	if (kind === "artist") {
		let artist = findArtist(id);
		return artist === undefined ? undefined : { name: artist.name, page: `artist/${artist.id}` };
	}
	let track = findTrack(id);
	let entry = track === undefined ? undefined : findAlbum(track.album);
	return entry === undefined ? undefined : { name: entry.title, page: `album/${entry.id}` };
}
