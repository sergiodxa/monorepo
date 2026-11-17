/**
 * Vesper's catalogue: invented series and films with their seasons and episodes, the genres
 * they file under, the household's profiles and what each one is part way through. Every
 * screen reads these fixtures; nothing here names or depicts a real title.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoAppActionHref, demoAppHref } from "~/resources/views/demo-apps";

/** The folder name the app is served under. */
export const SLUG = "vesper";

/** The address of a Vesper screen. */
export const href = demoAppHref(SLUG);

/** The address a Vesper form posts to. */
export const actionHref = demoAppActionHref(SLUG);

/** The scene a title's key art draws, each an original composition. */
export type Motif =
	| "waves"
	| "lanterns"
	| "rails"
	| "moon"
	| "orbit"
	| "glass"
	| "peaks"
	| "dunes"
	| "city"
	| "table"
	| "birds"
	| "forest"
	| "signal"
	| "bloom";

/** How a title's name is set in its key art. */
export type Lettering = "serif" | "wide" | "condensed" | "script" | "mono";

/** A genre a title files under. */
export interface Genre {
	id: string;
	name: string;
}

/** One episode of a season. */
export interface Episode {
	number: number;
	title: string;
	minutes: number;
	synopsis?: string;
}

/** One season of a series. */
export interface Season {
	number: number;
	year: number;
	episodes: Episode[];
}

/** A series or a film in the catalogue. */
export interface Title {
	id: string;
	name: string;
	kind: "series" | "film";
	year: number;
	/** The age rating as the badge reads. */
	rating: string;
	genres: string[];
	/** One line for a card's hover and the hero. */
	tagline: string;
	synopsis: string;
	/** Made by Vesper, which the cards and hero mark. */
	original: boolean;
	motif: Motif;
	lettering: Lettering;
	/** The key art's sky, from its top to its horizon, and the light in it. */
	palette: { sky: string; horizon: string; light: string };
	cast: string[];
	creators: string[];
	/** A film's running time. */
	minutes?: number;
	seasons?: Season[];
	/** A label on the card, such as "New episodes". */
	badge?: string;
	/** Fit for the kids' profile. */
	kids?: boolean;
}

/** A household member's profile. */
export interface Profile {
	id: string;
	name: string;
	/** The avatar's two colours. */
	tones: [string, string];
	kids?: boolean;
}

/** Where a profile left a title. */
export interface Progress {
	title: string;
	season?: number;
	episode?: number;
	/** The share of the episode or film watched, 0–1. */
	share: number;
}

/** Every genre, in the order the browse chips list them. */
export const GENRES: Genre[] = [
	{ id: "drama", name: "Drama" },
	{ id: "thriller", name: "Thrillers" },
	{ id: "mystery", name: "Mystery" },
	{ id: "sci-fi", name: "Science fiction" },
	{ id: "comedy", name: "Comedy" },
	{ id: "documentary", name: "Documentary" },
	{ id: "family", name: "Family" },
];

/**
 * Builds a season from its episode names and running times, so the fixtures stay a list of
 * what an episode is called rather than a wall of object literals.
 */
function season(
	number: number,
	year: number,
	episodes: Array<[title: string, minutes: number, synopsis?: string]>,
): Season {
	return {
		number,
		year,
		episodes: episodes.map(([title, minutes, synopsis], index) => ({
			number: index + 1,
			title,
			minutes,
			synopsis,
		})),
	};
}

/** The whole catalogue. The first title is the one the home screen features. */
export const TITLES: Title[] = [
	{
		id: "tidewater",
		name: "Tidewater",
		kind: "series",
		year: 2026,
		rating: "16+",
		genres: ["drama", "mystery"],
		tagline: "A harbour town keeps one secret a season.",
		synopsis:
			"When the last ferry of the year comes in a passenger short, harbourmaster Wren Okafor starts asking the questions the island has spent forty winters not answering.",
		original: true,
		motif: "waves",
		lettering: "serif",
		palette: {
			sky: "oklch(0.24 0.06 235)",
			horizon: "oklch(0.55 0.09 205)",
			light: "oklch(0.88 0.08 85)",
		},
		cast: ["Adaeze Moll", "Tomas Reyes-Hart", "Ilse Varga"],
		creators: ["Maren Holt"],
		badge: "New season",
		seasons: [
			season(1, 2025, [
				[
					"Last Ferry",
					52,
					"The year's final crossing docks one passenger short, and Wren signs the manifest anyway.",
				],
				["Slack Water", 47, "A diver finds a car where the old pier used to stand."],
				[
					"The Breakwater",
					49,
					"Wren's brother returns for the winter with a story that doesn't hold.",
				],
				[
					"Fog Signal",
					51,
					"A storm cuts the island off, and the radio picks up a voice from 1986.",
				],
				[
					"Neap Tide",
					46,
					"The council votes to dredge the harbour; someone would rather it didn't.",
				],
				["High Water Mark", 58, "Everything the tide took comes back in one night."],
			]),
			season(2, 2026, [
				[
					"Spring Tide",
					54,
					"A new harbourmaster arrives, and Wren is asked to show her the ropes.",
				],
				["Undertow", 48, "A summer regatta brings three hundred visitors and one old rival."],
				["Lee Shore", 50, "The car's owner has a daughter, and she has questions."],
				["Wreck Chart", 47, "Wren finds the original survey of the harbour, with a page missing."],
				["Ebb", 49, "The island's oldest resident asks for a boat and a witness."],
				["Turning", 56, "Two ferries, one night, and the truth on both."],
			]),
		],
	},
	{
		id: "halcyon-station",
		name: "Halcyon Station",
		kind: "series",
		year: 2026,
		rating: "13+",
		genres: ["sci-fi", "drama"],
		tagline: "Six people, one orbit, no way home until spring.",
		synopsis:
			"A research crew wintering on a station above an ice moon loses contact with Earth the same week their botanist's experiment starts answering back.",
		original: true,
		motif: "orbit",
		lettering: "wide",
		palette: {
			sky: "oklch(0.18 0.05 285)",
			horizon: "oklch(0.42 0.12 300)",
			light: "oklch(0.86 0.09 200)",
		},
		cast: ["Kiri Anand", "Bastien Lowe", "Oyelaran Fisk", "Mei Sato-Park"],
		creators: ["Jonah Dray", "Ruth Calloway"],
		badge: "New episodes",
		seasons: [
			season(1, 2026, [
				[
					"Wintering",
					55,
					"The supply ship leaves, and the station settles into six months of dark.",
				],
				[
					"Blackout",
					48,
					"A solar storm takes the relay down, and the crew votes on who goes outside.",
				],
				["Germination", 51, "Nadia's seedlings turn toward the moon instead of the lamps."],
				[
					"Dead Reckoning",
					47,
					"Without Earth, the navigator plots by hand and finds they've drifted.",
				],
				["Signal", 52, "A pattern in the static repeats every ninety-one minutes."],
				["Perihelion", 49, "The crew splits over whether to answer it."],
				["Root System", 53, "The greenhouse is sealed from the inside."],
				["Thaw", 61, "Spring comes early, and not for the reason anyone hoped."],
			]),
		],
	},
	{
		id: "ember-line",
		name: "Ember Line",
		kind: "series",
		year: 2025,
		rating: "16+",
		genres: ["thriller"],
		tagline: "The night train never stops twice at the same town.",
		synopsis:
			"An overnight sleeper crossing three borders carries a courier, a stolen ledger and the inspector who has been chasing both for a decade.",
		original: true,
		motif: "rails",
		lettering: "condensed",
		palette: {
			sky: "oklch(0.2 0.04 30)",
			horizon: "oklch(0.48 0.16 40)",
			light: "oklch(0.85 0.15 70)",
		},
		cast: ["Lucan Ferro", "Hanne Dahl", "Ade Coker"],
		creators: ["Sofia Brandt"],
		seasons: [
			season(1, 2025, [
				["Departure 23:10", 50, "A courier boards with a ledger she was told never to open."],
				["Couchette 9", 46, "The inspector takes the berth below hers."],
				["Border Control", 48, "Two passports, one face."],
				["The Dining Car", 44, "Dinner is served, and so is a warning."],
				["Points Failure", 51, "The train stops in a field, and the lights go out."],
				["Terminus", 57, "Dawn, a platform, and a choice."],
			]),
		],
	},
	{
		id: "paper-moons",
		name: "Paper Moons",
		kind: "film",
		year: 2024,
		rating: "All ages",
		genres: ["family"],
		tagline: "One girl, one kite, one very large moon.",
		synopsis:
			"When the moon gets snagged on the town's church steeple, a kite-maker's daughter and her grumpy grandfather set out to give it back to the sky.",
		original: false,
		motif: "moon",
		lettering: "script",
		palette: {
			sky: "oklch(0.3 0.08 265)",
			horizon: "oklch(0.62 0.1 300)",
			light: "oklch(0.95 0.06 95)",
		},
		cast: ["Pip Alder", "Gregor Moss"],
		creators: ["Lena Oduya"],
		minutes: 92,
		kids: true,
	},
	{
		id: "glasshouse",
		name: "Glasshouse",
		kind: "series",
		year: 2024,
		rating: "18+",
		genres: ["thriller", "mystery"],
		tagline: "Everyone can see in. Nobody looks.",
		synopsis:
			"An architect's prize-winning glass home becomes the scene of an impossible disappearance, watched by twelve neighbours who all saw something different.",
		original: false,
		motif: "glass",
		lettering: "mono",
		palette: {
			sky: "oklch(0.22 0.03 160)",
			horizon: "oklch(0.5 0.07 170)",
			light: "oklch(0.9 0.05 150)",
		},
		cast: ["Corin Vale", "Dee Abara", "Hal Mercer"],
		creators: ["Pia Lindqvist"],
		seasons: [
			season(1, 2024, [
				["Open Plan", 49, "A dinner party, a power cut, and an empty chair."],
				["Sightlines", 45, "The neighbours give twelve statements and one shared lie."],
				["Load Bearing", 47, "The architect's plans show a room the house doesn't have."],
				["Reflection", 50, "A photograph taken from across the street changes everything."],
				["Frosted", 52, "The glass is replaced, and so is the story."],
			]),
		],
	},
	{
		id: "low-country",
		name: "Low Country",
		kind: "film",
		year: 2025,
		rating: "All ages",
		genres: ["documentary"],
		tagline: "A year on the last working salt marsh.",
		synopsis:
			"Four generations of one family harvest salt the way their great-grandparents did, through a year of floods, heat and a buyer who wants the land.",
		original: true,
		motif: "dunes",
		lettering: "serif",
		palette: {
			sky: "oklch(0.32 0.05 60)",
			horizon: "oklch(0.7 0.09 75)",
			light: "oklch(0.95 0.05 90)",
		},
		cast: ["The Marchetti family"],
		creators: ["Ewan Price"],
		minutes: 88,
		kids: true,
	},
	{
		id: "northbound",
		name: "Northbound",
		kind: "series",
		year: 2025,
		rating: "All ages",
		genres: ["documentary"],
		tagline: "Three thousand kilometres on foot, one valley at a time.",
		synopsis:
			"A long-distance walker follows an old drovers' road from the coast to the ice, meeting the people who still live along it.",
		original: true,
		motif: "peaks",
		lettering: "wide",
		palette: {
			sky: "oklch(0.28 0.05 230)",
			horizon: "oklch(0.72 0.05 220)",
			light: "oklch(0.97 0.02 220)",
		},
		cast: ["Ama Thorsen"],
		creators: ["Ama Thorsen", "Kit Bell"],
		kids: true,
		seasons: [
			season(1, 2025, [
				["The Coast Road", 44],
				["Hill Farms", 42],
				["The Pass", 46],
				["Snowline", 45],
			]),
		],
	},
	{
		id: "the-quiet-hours",
		name: "The Quiet Hours",
		kind: "film",
		year: 2023,
		rating: "16+",
		genres: ["mystery", "drama"],
		tagline: "A night porter hears everything between two and five.",
		synopsis:
			"In a hotel that has outlived its city, the night porter pieces together a guest's last evening from what the walls let through.",
		original: false,
		motif: "city",
		lettering: "serif",
		palette: {
			sky: "oklch(0.16 0.03 260)",
			horizon: "oklch(0.35 0.08 280)",
			light: "oklch(0.86 0.12 80)",
		},
		cast: ["Rafe Aldana", "Jun Ito"],
		creators: ["Marguerite Osei"],
		minutes: 104,
	},
	{
		id: "kitchen-table",
		name: "Kitchen Table",
		kind: "series",
		year: 2026,
		rating: "13+",
		genres: ["comedy"],
		tagline: "Four flatmates, one lease, no clean mugs.",
		synopsis:
			"A sous-chef, a law student, a retired magician and a very tidy accountant share a flat above a bakery and a running argument about the dishes.",
		original: true,
		motif: "table",
		lettering: "condensed",
		palette: {
			sky: "oklch(0.3 0.07 50)",
			horizon: "oklch(0.68 0.14 60)",
			light: "oklch(0.95 0.08 95)",
		},
		cast: ["Nell Ashby", "Ravi Kohli", "Ottilie Brand", "Sam Achebe"],
		creators: ["Dev Malhotra"],
		seasons: [
			season(1, 2026, [
				["Moving In", 28],
				["The Rota", 26],
				["Sourdough", 27],
				["Housewarming", 29],
				["The Inspection", 25],
				["Lease Renewal", 31],
			]),
		],
	},
	{
		id: "starling-and-finch",
		name: "Starling & Finch",
		kind: "series",
		year: 2024,
		rating: "All ages",
		genres: ["comedy", "family"],
		tagline: "Two birds, one tiny detective agency.",
		synopsis:
			"A starling who notices everything and a finch who notices nothing solve the small mysteries of a city park.",
		original: false,
		motif: "birds",
		lettering: "script",
		palette: {
			sky: "oklch(0.42 0.09 210)",
			horizon: "oklch(0.78 0.1 130)",
			light: "oklch(0.96 0.07 100)",
		},
		cast: ["Bea Holloway", "Marcus Lind"],
		creators: ["Yuki Tamura"],
		kids: true,
		seasons: [
			season(1, 2024, [
				["The Missing Crumb", 22],
				["Pond Life", 22],
				["The Bench Bandit", 23],
				["Fog in the Park", 22],
				["Night Watch", 24],
			]),
		],
	},
	{
		id: "undertow",
		name: "Undertow",
		kind: "film",
		year: 2025,
		rating: "18+",
		genres: ["thriller"],
		tagline: "Some debts are paid at sea.",
		synopsis:
			"A disgraced lifeguard takes one last job ferrying a stranger across a closed strait, and learns too late what's in the hold.",
		original: true,
		motif: "waves",
		lettering: "condensed",
		palette: {
			sky: "oklch(0.18 0.05 20)",
			horizon: "oklch(0.4 0.13 25)",
			light: "oklch(0.8 0.14 45)",
		},
		cast: ["Dario Bellini", "Fen Ashdown"],
		creators: ["Caleb Rourke"],
		minutes: 111,
	},
	{
		id: "moss-and-stone",
		name: "Moss & Stone",
		kind: "series",
		year: 2023,
		rating: "All ages",
		genres: ["documentary"],
		tagline: "The slowest drama on the planet, filmed for a decade.",
		synopsis:
			"Time-lapse cameras left in five ancient forests for ten years show how the smallest things decide which trees survive.",
		original: false,
		motif: "forest",
		lettering: "serif",
		palette: {
			sky: "oklch(0.24 0.05 150)",
			horizon: "oklch(0.55 0.1 140)",
			light: "oklch(0.92 0.09 120)",
		},
		cast: ["Narrated by Iris Okonjo"],
		creators: ["Hollis Weir"],
		kids: true,
		seasons: [
			season(1, 2023, [
				["Canopy", 50],
				["Understorey", 48],
				["Deadwood", 49],
				["Seedfall", 51],
			]),
		],
	},
	{
		id: "signal-fire",
		name: "Signal Fire",
		kind: "film",
		year: 2026,
		rating: "13+",
		genres: ["sci-fi"],
		tagline: "Someone lit the beacon. Nobody remembers building it.",
		synopsis:
			"On a mountain above a drowned valley, a surveyor finds a beacon that only burns when it's about to be needed.",
		original: true,
		motif: "signal",
		lettering: "wide",
		palette: {
			sky: "oklch(0.2 0.06 255)",
			horizon: "oklch(0.45 0.13 30)",
			light: "oklch(0.88 0.16 60)",
		},
		cast: ["Selin Kaya", "Owen Thrale"],
		creators: ["Ana Ribeiro"],
		minutes: 118,
		badge: "New",
	},
	{
		id: "second-spring",
		name: "Second Spring",
		kind: "series",
		year: 2025,
		rating: "13+",
		genres: ["drama"],
		tagline: "Retired, widowed, and opening a nursery at seventy.",
		synopsis:
			"Three neighbours in their seventies turn a derelict glasshouse into a plant nursery, and find out they have more to grow than tomatoes.",
		original: false,
		motif: "bloom",
		lettering: "script",
		palette: {
			sky: "oklch(0.3 0.06 340)",
			horizon: "oklch(0.7 0.1 10)",
			light: "oklch(0.96 0.05 80)",
		},
		cast: ["Margot Ellis", "Ken Adeyemi", "Rosa Lund"],
		creators: ["Hattie Crane"],
		seasons: [
			season(1, 2025, [
				["Cuttings", 45],
				["Frost Warning", 43],
				["Potting On", 46],
				["Open Day", 47],
				["Hardening Off", 44],
				["First Bloom", 52],
			]),
		],
	},
	{
		id: "the-lantern-year",
		name: "The Lantern Year",
		kind: "series",
		year: 2024,
		rating: "13+",
		genres: ["drama", "family"],
		tagline: "Twelve festivals, one family, one year to make it right.",
		synopsis:
			"A family scattered across three cities agrees to meet once a month for a year, at every lantern festival their late mother loved.",
		original: true,
		motif: "lanterns",
		lettering: "serif",
		palette: {
			sky: "oklch(0.2 0.05 300)",
			horizon: "oklch(0.45 0.12 20)",
			light: "oklch(0.88 0.15 70)",
		},
		cast: ["Lin Hao", "Mira Castell", "Jae Moon"],
		creators: ["Grace Whitfield"],
		seasons: [
			season(1, 2024, [
				["First Light", 48],
				["Rain Festival", 46],
				["The Long Table", 49],
				["Paper and Flame", 47],
				["Midsummer", 50],
				["The Last Lantern", 55],
			]),
		],
	},
	{
		id: "saltgrass",
		name: "Saltgrass",
		kind: "film",
		year: 2022,
		rating: "13+",
		genres: ["drama"],
		tagline: "Two sisters, one inheritance, a field nobody wants.",
		synopsis:
			"Estranged sisters return to the coastal farm they inherited and have one summer to decide whether to sell it or save it.",
		original: false,
		motif: "dunes",
		lettering: "wide",
		palette: {
			sky: "oklch(0.36 0.06 220)",
			horizon: "oklch(0.78 0.08 85)",
			light: "oklch(0.97 0.04 90)",
		},
		cast: ["Hedda Strand", "Clio Marsh"],
		creators: ["Ivo Petrov"],
		minutes: 97,
	},
];

/** The household's profiles. */
export const PROFILES: Profile[] = [
	{ id: "noa", name: "Noa", tones: ["oklch(0.72 0.17 50)", "oklch(0.52 0.19 25)"] },
	{ id: "theo", name: "Theo", tones: ["oklch(0.75 0.11 200)", "oklch(0.5 0.12 240)"] },
	{ id: "ines", name: "Ines", tones: ["oklch(0.72 0.14 320)", "oklch(0.5 0.17 290)"] },
	{ id: "kids", name: "Kids", tones: ["oklch(0.85 0.17 120)", "oklch(0.65 0.18 150)"], kids: true },
];

/** The profile a visitor who has not picked one watches as. */
export const DEFAULT_PROFILE = "noa";

/** What each profile is part way through, most recent first. */
export const CONTINUE: Record<string, Progress[]> = {
	noa: [
		{ title: "tidewater", season: 2, episode: 3, share: 0.42 },
		{ title: "halcyon-station", season: 1, episode: 5, share: 0.18 },
		{ title: "the-quiet-hours", share: 0.71 },
		{ title: "kitchen-table", season: 1, episode: 4, share: 0.55 },
		{ title: "moss-and-stone", season: 1, episode: 2, share: 0.3 },
	],
	theo: [
		{ title: "ember-line", season: 1, episode: 2, share: 0.64 },
		{ title: "signal-fire", share: 0.12 },
		{ title: "glasshouse", season: 1, episode: 4, share: 0.9 },
	],
	ines: [
		{ title: "second-spring", season: 1, episode: 5, share: 0.37 },
		{ title: "the-lantern-year", season: 1, episode: 2, share: 0.8 },
	],
	kids: [
		{ title: "starling-and-finch", season: 1, episode: 3, share: 0.5 },
		{ title: "paper-moons", share: 0.25 },
	],
};

/** The titles most watched this week, in rank order. */
export const TRENDING = [
	"halcyon-station",
	"tidewater",
	"signal-fire",
	"ember-line",
	"kitchen-table",
	"glasshouse",
	"undertow",
	"second-spring",
];

/** What is new on Vesper, newest first, as the bell's panel lists it. */
export const UPDATES: Array<{ title: string; what: string; when: string }> = [
	{ title: "halcyon-station", what: "New episodes", when: "Today" },
	{ title: "signal-fire", what: "New arrival", when: "2 days ago" },
	{ title: "tidewater", what: "Season 2 is here", when: "1 week ago" },
	{ title: "kitchen-table", what: "New arrival", when: "2 weeks ago" },
	{ title: "starling-and-finch", what: "New arrival", when: "3 weeks ago" },
];

/** The rank each of the week's most watched titles holds, by id. */
export function trendingRank(id: string): number | undefined {
	let index = TRENDING.indexOf(id);
	return index === -1 ? undefined : index + 1;
}

/** My List as a profile finds it before changing it. */
export const DEFAULT_LIST = ["ember-line", "low-country", "paper-moons", "glasshouse"];

/**
 * Finds a title by its id.
 *
 * @param id The id an address carries.
 * @returns The title, or `undefined` for one the catalogue lacks.
 */
export function findTitle(id: string): Title | undefined {
	return TITLES.find((title) => title.id === id);
}

/**
 * Finds a profile by its id.
 *
 * @param id The id a cookie or form carries.
 * @returns The profile, or `undefined` for one the household lacks.
 */
export function findProfile(id: string): Profile | undefined {
	return PROFILES.find((profile) => profile.id === id);
}

/**
 * Finds a genre by its id.
 *
 * @param id The id an address carries.
 * @returns The genre, or `undefined`.
 */
export function findGenre(id: string): Genre | undefined {
	return GENRES.find((genre) => genre.id === id);
}

/**
 * The titles a profile may see: everything, or only the kids' titles on a kids' profile.
 *
 * @param profile The profile watching.
 * @returns The titles in catalogue order.
 */
export function visibleTitles(profile: Profile): Title[] {
	return profile.kids ? TITLES.filter((title) => title.kids) : TITLES;
}

/**
 * Finds an episode of a series.
 *
 * @returns The season and episode, or `undefined` for a number the series lacks.
 */
export function findEpisode(
	title: Title,
	seasonNumber: number,
	episodeNumber: number,
): { season: Season; episode: Episode } | undefined {
	let found = title.seasons?.find((candidate) => candidate.number === seasonNumber);
	let episode = found?.episodes.find((candidate) => candidate.number === episodeNumber);
	return found === undefined || episode === undefined ? undefined : { season: found, episode };
}

/**
 * The episode after one, crossing into the next season at a season's end.
 *
 * @returns The next episode, or `undefined` after a series' last.
 */
export function nextEpisode(
	title: Title,
	seasonNumber: number,
	episodeNumber: number,
): { season: Season; episode: Episode } | undefined {
	return (
		findEpisode(title, seasonNumber, episodeNumber + 1) ?? findEpisode(title, seasonNumber + 1, 1)
	);
}

/**
 * A title's length as a card's meta line reads it: a film's running time, or a series' season count.
 *
 * @example lengthLabel(tidewater) // "2 seasons"
 */
export function lengthLabel(title: Title): string {
	if (title.kind === "film") return formatMinutes(title.minutes ?? 0);
	let count = title.seasons?.length ?? 0;
	if (count > 1) return `${count} seasons`;
	return `${title.seasons?.[0]?.episodes.length ?? 0} episodes`;
}

/**
 * A running time in hours and minutes, the way a catalogue prints it.
 *
 * @example formatMinutes(104) // "1h 44m"
 */
export function formatMinutes(minutes: number): string {
	let hours = Math.floor(minutes / 60);
	let rest = minutes % 60;
	if (hours === 0) return `${rest}m`;
	return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** The genre names a title files under, joined for a meta line. */
export function genreNames(title: Title): string[] {
	return title.genres.map((id) => findGenre(id)?.name ?? id);
}

/**
 * The address that plays a title: a film itself, or a series' episode.
 *
 * @param title The title to play.
 * @param seasonNumber The season, for a series.
 * @param episodeNumber The episode, for a series.
 */
export function watchHref(title: Title, seasonNumber = 1, episodeNumber = 1): string {
	return title.kind === "film"
		? href(`watch/${title.id}`)
		: href(`watch/${title.id}/${seasonNumber}-${episodeNumber}`);
}

/**
 * Titles that share a genre with one, nearest first, for "More like this".
 *
 * @returns Up to eight other titles, the most genres in common first.
 */
export function similarTitles(title: Title, pool: Title[]): Title[] {
	return pool
		.filter((candidate) => candidate.id !== title.id)
		.map((candidate) => ({
			candidate,
			shared: candidate.genres.filter((genre) => title.genres.includes(genre)).length,
		}))
		.filter((entry) => entry.shared > 0)
		.sort((a, b) => b.shared - a.shared)
		.slice(0, 8)
		.map((entry) => entry.candidate);
}

/**
 * Titles matching a search: by name first, then by genre, cast or creator.
 *
 * @param query What the visitor typed.
 * @param pool The titles the profile may see.
 * @returns The matches, name matches first; none for a blank query.
 */
export function searchTitles(query: string, pool: Title[]): Title[] {
	let needle = query.trim().toLowerCase();
	if (needle === "") return [];
	let byName = pool.filter((title) => title.name.toLowerCase().includes(needle));
	let rest = pool.filter(
		(title) =>
			!byName.includes(title) &&
			[...genreNames(title), ...title.cast, ...title.creators, title.tagline].some((field) =>
				field.toLowerCase().includes(needle),
			),
	);
	return [...byName, ...rest];
}
