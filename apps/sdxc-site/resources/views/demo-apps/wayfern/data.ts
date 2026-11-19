/**
 * Wayfern's world: six real towns on São Miguel in the Azores, the invented stays in
 * them, their hosts, amenities and reviews, and the fake saved cards checkout picks from.
 * The towns are real; every stay, host and person is made up. Prices are whole US cents.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoAppActionHref, demoAppHref } from "~/resources/views/demo-apps";

/** The folder name the demo lives under, which every address is built from. */
export const SLUG = "wayfern";

/** An address under Wayfern: a page path, with its query string when it keeps one. */
export const href = demoAppHref(SLUG);

/** The address a Wayfern form posts to for the page it acts on. */
export const actionHref = demoAppActionHref(SLUG);

/** The landscape a place, and every stay in it, is drawn from. */
export type Motif = "coast" | "dunes" | "pines" | "lake" | "peaks" | "town";

/** One place a search can name. */
export interface Place {
	id: string;
	name: string;
	/** The few words a suggestion row carries under the name. */
	blurb: string;
	motif: Motif;
	/** The place's centre on the drawn miniature map, in its `0 0 400 300` units. */
	x: number;
	y: number;
	/** Where it really is, as `[longitude, latitude]`. */
	at: [number, number];
}

/** Every place, in the order the search suggests them. */
export const PLACES: Place[] = [
	{
		id: "ponta-delgada",
		name: "Ponta Delgada",
		blurb: "Harbour cottages in the island's capital",
		motif: "coast",
		x: 300,
		y: 205,
		at: [-25.668, 37.741],
	},
	{
		id: "furnas",
		name: "Furnas",
		blurb: "Cabins deep in the old pinewood",
		motif: "pines",
		x: 105,
		y: 135,
		at: [-25.316, 37.773],
	},
	{
		id: "sete-cidades",
		name: "Sete Cidades",
		blurb: "Boathouses on three still lakes",
		motif: "lake",
		x: 205,
		y: 120,
		at: [-25.791, 37.861],
	},
	{
		id: "nordeste",
		name: "Nordeste",
		blurb: "Bothies under the ridge walks",
		motif: "peaks",
		x: 95,
		y: 55,
		at: [-25.149, 37.83],
	},
	{
		id: "vila-franca",
		name: "Vila Franca",
		blurb: "Lofts in a walled market town",
		motif: "town",
		x: 315,
		y: 90,
		at: [-25.433, 37.716],
	},
	{
		id: "ribeira-grande",
		name: "Ribeira Grande",
		blurb: "Dune huts where the river meets the sea",
		motif: "dunes",
		x: 190,
		y: 245,
		at: [-25.522, 37.822],
	},
];

/** The kinds of stay the type filter offers. */
export const STAY_TYPES = [
	{ id: "cabin", label: "Cabins" },
	{ id: "cottage", label: "Cottages" },
	{ id: "loft", label: "Lofts" },
	{ id: "apartment", label: "Apartments" },
	{ id: "treehouse", label: "Treehouses" },
	{ id: "farmhouse", label: "Farmhouses" },
] as const;

/** One kind of stay, as a stay and the type filter name it. */
export type StayType = (typeof STAY_TYPES)[number]["id"];

/** Every amenity a stay can list, in the order the listing and the filter show them. */
export const AMENITIES = [
	{ id: "wifi", label: "Fast wifi" },
	{ id: "kitchen", label: "Kitchen" },
	{ id: "parking", label: "Free parking" },
	{ id: "fireplace", label: "Wood fire" },
	{ id: "hot-tub", label: "Hot tub" },
	{ id: "sauna", label: "Sauna" },
	{ id: "washer", label: "Washer" },
	{ id: "workspace", label: "Desk for work" },
	{ id: "pets", label: "Dogs welcome" },
	{ id: "ev", label: "EV charger" },
	{ id: "water", label: "On the water" },
	{ id: "bikes", label: "Bikes to borrow" },
	{ id: "crib", label: "Cot and high chair" },
	{ id: "self-check-in", label: "Self check-in" },
] as const;

/** One amenity, as a stay and the filter name it. */
export type Amenity = (typeof AMENITIES)[number]["id"];

/** The amenities the results' filter shows first, the ones people search for most. */
export const FILTER_AMENITIES: Amenity[] = [
	"wifi",
	"kitchen",
	"hot-tub",
	"fireplace",
	"pets",
	"water",
	"sauna",
	"ev",
];

/** One host. */
export interface Host {
	id: string;
	name: string;
	/** Two hues the avatar's drawn tile blends. */
	hues: [number, number];
	since: number;
	/** Shown as "Hosts with care" when the host keeps a high bar. */
	trusted: boolean;
	responds: string;
	languages: string[];
	bio: string;
}

/** Every host, keyed by id through {@link findHost}. */
export const HOSTS: Host[] = [
	{
		id: "maren",
		name: "Maren Oyelaran",
		hues: [200, 230],
		since: 2019,
		trusted: true,
		responds: "within an hour",
		languages: ["English", "Norwegian"],
		bio: "I grew up mending nets in Ponta Delgada and now look after three cottages on the harbour wall.",
	},
	{
		id: "tobiah",
		name: "Tobiah Fenn",
		hues: [130, 160],
		since: 2021,
		trusted: true,
		responds: "within a few hours",
		languages: ["English"],
		bio: "Carpenter. Every cabin in Furnas with a curved roof is probably mine.",
	},
	{
		id: "ilse",
		name: "Ilse Marchetti",
		hues: [30, 10],
		since: 2018,
		trusted: true,
		responds: "within an hour",
		languages: ["English", "Italian", "German"],
		bio: "Architect, swimmer, early riser. The glasshouse was my thesis project, finally built.",
	},
	{
		id: "rafe",
		name: "Rafe Adebayo-Lund",
		hues: [280, 250],
		since: 2022,
		trusted: false,
		responds: "within a day",
		languages: ["English", "Yoruba"],
		bio: "I run the Vila Franca market bakery and rent the rooms above it. Breakfast is not optional.",
	},
	{
		id: "wren",
		name: "Wren Castellanos",
		hues: [90, 60],
		since: 2020,
		trusted: true,
		responds: "within an hour",
		languages: ["English", "Spanish"],
		bio: "Birdwatcher on the Reach. Ask me where the avocets are this week.",
	},
	{
		id: "hollis",
		name: "Hollis Graeme",
		hues: [350, 20],
		since: 2017,
		trusted: true,
		responds: "within a few hours",
		languages: ["English", "Gaelic"],
		bio: "Mountain guide. The bothies are stocked with maps, dry wood and a proper kettle.",
	},
];

/** The colours a stay's drawn photos are painted in. */
export interface StayPalette {
	/** The sky at the top of every outdoor picture. */
	sky: string;
	/** The ground or water band. */
	land: string;
	/** The building's walls. */
	wall: string;
	/** Its roof and trim. */
	roof: string;
	/** The inside: wall colour of the rooms. */
	room: string;
	/** Textiles: sofa, bedding, rug. */
	cloth: string;
}

/** One stay. */
export interface Stay {
	id: string;
	name: string;
	place: string;
	type: StayType;
	/** The listing's one-line pitch under its name. */
	line: string;
	description: string[];
	host: string;
	guests: number;
	bedrooms: number;
	beds: number;
	baths: number;
	/** A weeknight's price, in US cents; Friday and Saturday nights cost more. */
	nightly: number;
	cleaning: number;
	/** The shortest stay the host accepts. */
	minNights: number;
	rating: number;
	reviews: number;
	amenities: Amenity[];
	/** Where its pin sits on the drawn miniature map, in its units. */
	x: number;
	y: number;
	/** Where the stay really is, as `[longitude, latitude]`. */
	at: [number, number];
	palette: StayPalette;
	/** "Guest favourite" stays get a badge on their card. */
	favourite?: boolean;
	/** A few short things that set it apart, each with an icon key. */
	highlights: Array<{
		icon: "key" | "flame" | "medal" | "paw" | "sun" | "laptop";
		title: string;
		text: string;
	}>;
}

/** Every stay, in the order a search lists them before sorting. */
export const STAYS: Stay[] = [
	{
		id: "gullwing-cottage",
		name: "Gullwing Cottage",
		place: "ponta-delgada",
		type: "cottage",
		line: "A fisher's cottage on the harbour wall",
		description: [
			"Two rooms of whitewashed stone at the end of the harbour wall, with the tide a few steps from the door. The window seat looks straight down the bay to the lighthouse.",
			"There is a wood fire for the evenings, a deep bath, and a smokehouse two doors along that opens at seven.",
		],
		host: "maren",
		guests: 3,
		bedrooms: 1,
		beds: 2,
		baths: 1,
		nightly: 16_400,
		cleaning: 4_500,
		minNights: 2,
		rating: 4.94,
		reviews: 212,
		amenities: ["wifi", "kitchen", "fireplace", "water", "pets", "self-check-in"],
		x: 312,
		y: 214,
		at: [-25.6645, 37.7392],
		palette: {
			sky: "#cfe3ec",
			land: "#3f7f95",
			wall: "#f4efe6",
			roof: "#365765",
			room: "#efe9df",
			cloth: "#6e9db0",
		},
		favourite: true,
		highlights: [
			{ icon: "key", title: "Self check-in", text: "The key waits in a lockbox by the blue door." },
			{ icon: "paw", title: "Dogs welcome", text: "A towel, a bowl and the beach at low tide." },
			{ icon: "medal", title: "Hosts with care", text: "Maren has kept a high bar for six years." },
		],
	},
	{
		id: "the-tide-room",
		name: "The Tide Room",
		place: "ponta-delgada",
		type: "apartment",
		line: "A top-floor flat above the chandlery",
		description: [
			"A bright attic flat over the old chandlery, with a long table, a galley kitchen and a skylight over the bed for the stars.",
			"It is in the middle of town: the ferry, the bakery and the swimming steps are all under five minutes away.",
		],
		host: "maren",
		guests: 2,
		bedrooms: 1,
		beds: 1,
		baths: 1,
		nightly: 11_800,
		cleaning: 3_000,
		minNights: 1,
		rating: 4.81,
		reviews: 96,
		amenities: ["wifi", "kitchen", "workspace", "washer", "self-check-in"],
		x: 292,
		y: 198,
		at: [-25.6712, 37.7418],
		palette: {
			sky: "#d9e6ee",
			land: "#46809a",
			wall: "#e9d9c4",
			roof: "#8a4b3c",
			room: "#f3eee6",
			cloth: "#c99a6b",
		},
		highlights: [
			{ icon: "laptop", title: "Made for work", text: "A real desk, a good chair and fast wifi." },
			{ icon: "key", title: "Self check-in", text: "A keypad on the street door." },
		],
	},
	{
		id: "lantern-house",
		name: "Lantern House",
		place: "ponta-delgada",
		type: "farmhouse",
		line: "The old keeper's house on the headland",
		description: [
			"Four bedrooms around a big kitchen in the lighthouse keeper's house, with a walled garden that keeps the wind off and a lawn that runs to the cliff path.",
			"Built for families and long tables. The lamp still turns at night.",
		],
		host: "maren",
		guests: 8,
		bedrooms: 4,
		beds: 5,
		baths: 2,
		nightly: 38_500,
		cleaning: 12_000,
		minNights: 3,
		rating: 4.97,
		reviews: 58,
		amenities: ["wifi", "kitchen", "parking", "fireplace", "washer", "crib", "ev", "water"],
		x: 336,
		y: 232,
		at: [-25.6985, 37.7478],
		palette: {
			sky: "#c9dbe6",
			land: "#5d8a4a",
			wall: "#f6f2ea",
			roof: "#2f4a3a",
			room: "#ece4d6",
			cloth: "#b5654a",
		},
		favourite: true,
		highlights: [
			{ icon: "sun", title: "A walled garden", text: "Out of the wind, with a table for eight." },
			{ icon: "medal", title: "Hosts with care", text: "Maren has kept a high bar for six years." },
		],
	},
	{
		id: "dune-hollow",
		name: "Dune Hollow",
		place: "ribeira-grande",
		type: "cabin",
		line: "A timber hut tucked between two dunes",
		description: [
			"A small larch hut sheltered in a hollow of the dunes, with a deck that catches the evening sun and a path through the marram grass to an empty beach.",
			"Off-grid but comfortable: solar power, a wood-fired hot tub and a composting loo.",
		],
		host: "wren",
		guests: 2,
		bedrooms: 1,
		beds: 1,
		baths: 1,
		nightly: 13_900,
		cleaning: 3_500,
		minNights: 2,
		rating: 4.92,
		reviews: 141,
		amenities: ["kitchen", "parking", "hot-tub", "pets", "water"],
		x: 176,
		y: 254,
		at: [-25.5352, 37.8262],
		palette: {
			sky: "#f1dcc0",
			land: "#d8c08e",
			wall: "#9b7a57",
			roof: "#4f3d2c",
			room: "#e8dccb",
			cloth: "#7c9a7e",
		},
		favourite: true,
		highlights: [
			{ icon: "flame", title: "Wood-fired hot tub", text: "Wren lights it before you arrive." },
			{ icon: "paw", title: "Dogs welcome", text: "Miles of beach, few people." },
		],
	},
	{
		id: "reedline-studio",
		name: "Reedline Studio",
		place: "ribeira-grande",
		type: "loft",
		line: "A painter's studio over the reedbeds",
		description: [
			"A tall studio on stilts above the reedbeds, with a wall of glass facing the estuary and a mezzanine bed under the eaves.",
			"Bring binoculars: the hide is a two-minute walk along the boardwalk.",
		],
		host: "wren",
		guests: 2,
		bedrooms: 1,
		beds: 1,
		baths: 1,
		nightly: 12_200,
		cleaning: 3_000,
		minNights: 2,
		rating: 4.86,
		reviews: 73,
		amenities: ["wifi", "kitchen", "workspace", "bikes", "self-check-in"],
		x: 206,
		y: 236,
		at: [-25.5151, 37.8181],
		palette: {
			sky: "#e9e2cf",
			land: "#a4ab72",
			wall: "#d8cdb5",
			roof: "#56614a",
			room: "#f2ede2",
			cloth: "#c78d5b",
		},
		highlights: [
			{ icon: "laptop", title: "Made for work", text: "A drawing table under north light." },
			{ icon: "key", title: "Self check-in", text: "The code arrives the morning you travel." },
		],
	},
	{
		id: "herons-rest",
		name: "Heron's Rest",
		place: "ribeira-grande",
		type: "cottage",
		line: "A flint cottage at the river mouth",
		description: [
			"A two-bedroom flint cottage where the river slows into the sea, with a garden of sea kale and a bench that faces the herons at dusk.",
		],
		host: "wren",
		guests: 4,
		bedrooms: 2,
		beds: 3,
		baths: 1,
		nightly: 15_600,
		cleaning: 5_000,
		minNights: 2,
		rating: 4.78,
		reviews: 64,
		amenities: ["wifi", "kitchen", "parking", "fireplace", "crib", "water"],
		x: 222,
		y: 260,
		at: [-25.5046, 37.8224],
		palette: {
			sky: "#dfe4e1",
			land: "#7f9d8a",
			wall: "#c9c3b6",
			roof: "#3f4b4f",
			room: "#efe8dc",
			cloth: "#5d7f99",
		},
		highlights: [{ icon: "sun", title: "Evening bench", text: "West-facing, over the water." }],
	},
	{
		id: "pinecone-a-frame",
		name: "Pinecone A-frame",
		place: "furnas",
		type: "cabin",
		line: "A steep-roofed cabin under the tallest pines",
		description: [
			"An A-frame of black timber and glass under the tallest pines in the wood, with a sleeping loft, a sauna in the clearing and a cast-iron stove.",
			"Tobiah built it himself; the door handle is a piece of the tree it replaced.",
		],
		host: "tobiah",
		guests: 4,
		bedrooms: 2,
		beds: 2,
		baths: 1,
		nightly: 17_800,
		cleaning: 5_000,
		minNights: 2,
		rating: 4.96,
		reviews: 187,
		amenities: ["wifi", "kitchen", "parking", "fireplace", "sauna", "pets", "self-check-in"],
		x: 98,
		y: 128,
		at: [-25.3205, 37.7781],
		palette: {
			sky: "#d7e2d2",
			land: "#3f5f45",
			wall: "#2e2b29",
			roof: "#1f1d1c",
			room: "#e6dccd",
			cloth: "#b56b45",
		},
		favourite: true,
		highlights: [
			{
				icon: "flame",
				title: "Sauna in the clearing",
				text: "Wood-fired, with a cold plunge barrel.",
			},
			{ icon: "medal", title: "Hosts with care", text: "Tobiah answers within a few hours." },
		],
	},
	{
		id: "the-canopy",
		name: "The Canopy",
		place: "furnas",
		type: "treehouse",
		line: "A treehouse eleven metres up an old pine",
		description: [
			"A round room on a platform in the crowns, reached by a spiral stair, with a rope bridge to a second deck and a bath you fill with a copper can.",
		],
		host: "tobiah",
		guests: 2,
		bedrooms: 1,
		beds: 1,
		baths: 1,
		nightly: 21_500,
		cleaning: 4_000,
		minNights: 2,
		rating: 4.99,
		reviews: 310,
		amenities: ["wifi", "kitchen", "parking", "hot-tub"],
		x: 122,
		y: 146,
		at: [-25.3098, 37.7684],
		palette: {
			sky: "#dbe7cf",
			land: "#4c6a3c",
			wall: "#8a6a4a",
			roof: "#4b5a3a",
			room: "#efe5d3",
			cloth: "#c45c3f",
		},
		favourite: true,
		highlights: [
			{ icon: "sun", title: "Up in the crowns", text: "Woodpeckers at eye level." },
			{ icon: "medal", title: "Hosts with care", text: "Tobiah answers within a few hours." },
		],
	},
	{
		id: "mossback-lodge",
		name: "Mossback Lodge",
		place: "furnas",
		type: "cabin",
		line: "A turf-roofed lodge for a big group",
		description: [
			"Three bedrooms under a living roof, a long kitchen table and a fire pit ringed with logs. The forest trail starts at the gate.",
		],
		host: "tobiah",
		guests: 7,
		bedrooms: 3,
		beds: 4,
		baths: 2,
		nightly: 26_400,
		cleaning: 9_000,
		minNights: 3,
		rating: 4.83,
		reviews: 88,
		amenities: ["wifi", "kitchen", "parking", "fireplace", "washer", "pets", "crib", "bikes"],
		x: 80,
		y: 150,
		at: [-25.3262, 37.7652],
		palette: {
			sky: "#d3dccb",
			land: "#56703f",
			wall: "#6f5a45",
			roof: "#6f8f45",
			room: "#e9dfcf",
			cloth: "#4e6f8a",
		},
		highlights: [{ icon: "paw", title: "Dogs welcome", text: "Fenced garden and a boot room." }],
	},
	{
		id: "stillwater-boathouse",
		name: "Stillwater Boathouse",
		place: "sete-cidades",
		type: "cabin",
		line: "A boathouse with a rowing boat and a jetty",
		description: [
			"A converted boathouse over the water's edge on the middle lake, with a jetty for swimming, a rowing boat and a bed that looks straight out over the lake.",
		],
		host: "ilse",
		guests: 2,
		bedrooms: 1,
		beds: 1,
		baths: 1,
		nightly: 19_200,
		cleaning: 4_000,
		minNights: 2,
		rating: 4.93,
		reviews: 154,
		amenities: ["wifi", "kitchen", "parking", "water", "sauna", "self-check-in"],
		x: 198,
		y: 112,
		at: [-25.7948, 37.8588],
		palette: {
			sky: "#d5e1e6",
			land: "#4f7f86",
			wall: "#b4553f",
			roof: "#3a3a38",
			room: "#efe9e0",
			cloth: "#e0b45b",
		},
		favourite: true,
		highlights: [
			{ icon: "sun", title: "Swim from the jetty", text: "The lake is warmest in late August." },
			{ icon: "key", title: "Self check-in", text: "The boathouse key hangs in the porch." },
		],
	},
	{
		id: "ondine-glasshouse",
		name: "Ondine Glasshouse",
		place: "sete-cidades",
		type: "loft",
		line: "An architect's glass pavilion on the shore",
		description: [
			"A long glass pavilion on a stone plinth, open on three sides to the lake and the birches, with a concrete bath and a kitchen island built for cooking with friends.",
			"Curtains close it in completely at night.",
		],
		host: "ilse",
		guests: 4,
		bedrooms: 2,
		beds: 2,
		baths: 2,
		nightly: 32_000,
		cleaning: 8_000,
		minNights: 2,
		rating: 4.9,
		reviews: 47,
		amenities: ["wifi", "kitchen", "parking", "fireplace", "workspace", "ev", "water", "hot-tub"],
		x: 226,
		y: 126,
		at: [-25.7856, 37.8622],
		palette: {
			sky: "#dfe8ea",
			land: "#5f8c84",
			wall: "#d9dcd6",
			roof: "#4a4e4f",
			room: "#f1f0ec",
			cloth: "#9b8aa8",
		},
		highlights: [
			{ icon: "laptop", title: "Made for work", text: "A desk at the glass, fibre broadband." },
			{ icon: "medal", title: "Hosts with care", text: "Ilse has hosted since 2018." },
		],
	},
	{
		id: "kingfisher-cottage",
		name: "Kingfisher Cottage",
		place: "sete-cidades",
		type: "cottage",
		line: "A stone cottage between the lakes",
		description: [
			"A slate-roofed cottage on the path between the upper and middle lakes, with a stove, a reading nook and bikes in the shed for the lake loop.",
		],
		host: "ilse",
		guests: 4,
		bedrooms: 2,
		beds: 3,
		baths: 1,
		nightly: 14_200,
		cleaning: 4_500,
		minNights: 2,
		rating: 4.74,
		reviews: 119,
		amenities: ["wifi", "kitchen", "parking", "fireplace", "bikes", "pets", "crib"],
		x: 214,
		y: 98,
		at: [-25.8012, 37.8551],
		palette: {
			sky: "#d9e3e1",
			land: "#5a7d5f",
			wall: "#a7a196",
			roof: "#3d4448",
			room: "#efe7da",
			cloth: "#2f7c8c",
		},
		highlights: [{ icon: "paw", title: "Dogs welcome", text: "Up to two, on the lake loop." }],
	},
	{
		id: "cloudberry-bothy",
		name: "Cloudberry Bothy",
		place: "nordeste",
		type: "cabin",
		line: "A shepherd's bothy at the foot of the corrie",
		description: [
			"A thick-walled stone bothy at the end of the track, restored with a box bed, a stove and a window framed on the corrie's waterfall.",
			"Hollis leaves maps of the three ridge walks on the table.",
		],
		host: "hollis",
		guests: 2,
		bedrooms: 1,
		beds: 1,
		baths: 1,
		nightly: 9_800,
		cleaning: 2_500,
		minNights: 2,
		rating: 4.91,
		reviews: 133,
		amenities: ["kitchen", "parking", "fireplace", "pets"],
		x: 86,
		y: 60,
		at: [-25.1602, 37.8251],
		palette: {
			sky: "#d8dde4",
			land: "#6b7f5a",
			wall: "#8e8a83",
			roof: "#3b3f45",
			room: "#e7e0d4",
			cloth: "#a14b3b",
		},
		highlights: [
			{ icon: "flame", title: "Stove and dry wood", text: "Stacked high for wet days." },
			{ icon: "medal", title: "Hosts with care", text: "Hollis has hosted since 2017." },
		],
	},
	{
		id: "ridgeback-hut",
		name: "Ridgeback Hut",
		place: "nordeste",
		type: "cabin",
		line: "A mountain hut with a sauna on the ridge",
		description: [
			"A modern hut clad in weathered steel, high on the shoulder of the ridge, with bunks for six, a drying room and a sauna that looks over three valleys.",
		],
		host: "hollis",
		guests: 6,
		bedrooms: 2,
		beds: 4,
		baths: 1,
		nightly: 18_900,
		cleaning: 6_000,
		minNights: 2,
		rating: 4.85,
		reviews: 61,
		amenities: ["wifi", "kitchen", "parking", "sauna", "washer", "self-check-in"],
		x: 112,
		y: 44,
		at: [-25.1798, 37.8102],
		palette: {
			sky: "#cfd8e3",
			land: "#7a8a6a",
			wall: "#8c5a3c",
			roof: "#2f2f31",
			room: "#ece6dc",
			cloth: "#3f6b8c",
		},
		highlights: [
			{ icon: "flame", title: "Sauna on the ridge", text: "Three valleys from the bench." },
		],
	},
	{
		id: "clocktower-loft",
		name: "Clocktower Loft",
		place: "vila-franca",
		type: "loft",
		line: "A loft behind the market clock",
		description: [
			"A beamed loft behind the face of the old market clock, with a free-standing bath, a reading ladder and the market square three floors below.",
			"The clock chimes until ten and then politely stops.",
		],
		host: "rafe",
		guests: 2,
		bedrooms: 1,
		beds: 1,
		baths: 1,
		nightly: 15_900,
		cleaning: 3_500,
		minNights: 1,
		rating: 4.88,
		reviews: 204,
		amenities: ["wifi", "kitchen", "workspace", "washer", "self-check-in"],
		x: 318,
		y: 86,
		at: [-25.4321, 37.7172],
		palette: {
			sky: "#e6dfd3",
			land: "#9a8c7a",
			wall: "#c98f5d",
			roof: "#5d3a2c",
			room: "#f2eadd",
			cloth: "#5c6f4a",
		},
		favourite: true,
		highlights: [
			{ icon: "key", title: "Self check-in", text: "A code for the side door off the square." },
			{ icon: "laptop", title: "Made for work", text: "A desk under the clock face." },
		],
	},
	{
		id: "ropemakers-rooms",
		name: "Ropemaker's Rooms",
		place: "vila-franca",
		type: "apartment",
		line: "Rooms above the bakery on Long Walk",
		description: [
			"Two rooms above Rafe's bakery on the old ropewalk, with wide boards, tall windows and fresh bread on the landing at eight.",
		],
		host: "rafe",
		guests: 3,
		bedrooms: 1,
		beds: 2,
		baths: 1,
		nightly: 10_600,
		cleaning: 2_500,
		minNights: 1,
		rating: 4.69,
		reviews: 152,
		amenities: ["wifi", "kitchen", "washer", "bikes"],
		x: 330,
		y: 100,
		at: [-25.4362, 37.7191],
		palette: {
			sky: "#e9e1d5",
			land: "#a39582",
			wall: "#e3c9a1",
			roof: "#6a4636",
			room: "#f4ede1",
			cloth: "#a3473b",
		},
		highlights: [
			{ icon: "sun", title: "Breakfast included", text: "Bread from downstairs, every day." },
		],
	},
	{
		id: "orchard-farmhouse",
		name: "Orchard Farmhouse",
		place: "vila-franca",
		type: "farmhouse",
		line: "A farmhouse in the cider orchards outside town",
		description: [
			"A rambling farmhouse in twelve acres of cider orchard, a short cycle from the town walls, with a big kitchen, a games barn and a pool fed by the spring.",
		],
		host: "rafe",
		guests: 10,
		bedrooms: 5,
		beds: 7,
		baths: 3,
		nightly: 42_000,
		cleaning: 15_000,
		minNights: 3,
		rating: 4.8,
		reviews: 39,
		amenities: ["wifi", "kitchen", "parking", "fireplace", "washer", "pets", "crib", "bikes", "ev"],
		x: 350,
		y: 120,
		at: [-25.4198, 37.7283],
		palette: {
			sky: "#dfe6d6",
			land: "#7c9a4f",
			wall: "#efe2c6",
			roof: "#7a3e2e",
			room: "#f1e8d8",
			cloth: "#4f7a5a",
		},
		highlights: [
			{ icon: "paw", title: "Dogs welcome", text: "Twelve acres of orchard to run in." },
			{ icon: "sun", title: "Spring-fed pool", text: "Open May to September." },
		],
	},
];

/** The rooms each stay's photos show, in gallery order; the first is the cover. */
export const PHOTO_KINDS = ["outside", "living", "bedroom", "kitchen", "view", "bath"] as const;

/** One photo's subject. */
export type PhotoKind = (typeof PHOTO_KINDS)[number];

/** How each photo reads to someone who cannot see it, and its caption in the viewer. */
export const PHOTO_CAPTIONS: Record<PhotoKind, string> = {
	outside: "From outside",
	living: "The living room",
	bedroom: "The bedroom",
	kitchen: "The kitchen",
	view: "The view",
	bath: "The bathroom",
};

/** The scores a review rates, each shown as a bar on the listing. */
export const RATING_CATEGORIES = [
	{ id: "cleanliness", label: "Cleanliness" },
	{ id: "accuracy", label: "Accuracy" },
	{ id: "check-in", label: "Check-in" },
	{ id: "communication", label: "Communication" },
	{ id: "location", label: "Location" },
	{ id: "value", label: "Value" },
] as const;

/** One written review. */
export interface Review {
	author: string;
	from: string;
	/** Month and year, as the listing prints it. */
	when: string;
	rating: number;
	text: string;
	hue: number;
}

/** The review pool every stay draws its written reviews from, so each stay reads differently. */
const REVIEW_POOL: Array<Omit<Review, "when">> = [
	{
		author: "Priya",
		from: "Leeds",
		rating: 5,
		hue: 20,
		text: "Exactly as the pictures, only quieter. We lit the fire every night and didn't want to leave.",
	},
	{
		author: "Jonas",
		from: "Aarhus",
		rating: 5,
		hue: 210,
		text: "Thoughtful touches everywhere: good knives, real coffee, a map with the host's favourite walks.",
	},
	{
		author: "Amara",
		from: "Bristol",
		rating: 4,
		hue: 300,
		text: "Lovely spot. The road in is narrow and steep, so arrive in daylight if you can.",
	},
	{
		author: "Teodor",
		from: "Kraków",
		rating: 5,
		hue: 140,
		text: "Check-in took a minute, the bed was the best we've slept in all year, and the view did the rest.",
	},
	{
		author: "Ffion",
		from: "Cardiff",
		rating: 5,
		hue: 60,
		text: "Our host replied within minutes when we asked about the tides. Spotless and warm.",
	},
	{
		author: "Mateo",
		from: "Valencia",
		rating: 4,
		hue: 0,
		text: "Beautiful and calm. Wifi was patchy in the bedroom, fine everywhere else.",
	},
	{
		author: "Hana",
		from: "Osaka",
		rating: 5,
		hue: 330,
		text: "We came for two nights and stayed five. The kids still talk about the boat.",
	},
	{
		author: "Callum",
		from: "Inverness",
		rating: 5,
		hue: 180,
		text: "A proper retreat. Bring boots, bring a book, and leave the laptop in the car.",
	},
];

/** The months the newest reviews were written in, most recent first. */
const REVIEW_MONTHS = ["October 2026", "September 2026", "August 2026", "July 2026", "June 2026"];

/**
 * A stay's written reviews: four from the pool, starting at a place its id picks, so each stay
 * shows its own mix and the same stay always shows the same ones.
 */
export function reviewsFor(stay: Stay): Review[] {
	let start = hashOf(stay.id) % REVIEW_POOL.length;
	return [0, 1, 2, 3].map((offset) => {
		let review = REVIEW_POOL[(start + offset * 3) % REVIEW_POOL.length]!;
		return { ...review, when: REVIEW_MONTHS[offset % REVIEW_MONTHS.length]! };
	});
}

/**
 * A stay's score per category, close to its overall rating: location and value move around
 * it by the stay's id, so no two stays have identical bars.
 */
export function categoryScores(stay: Stay): Array<{ id: string; label: string; score: number }> {
	return RATING_CATEGORIES.map((category, index) => {
		let wobble = ((hashOf(`${stay.id}:${category.id}`) % 21) - 10) / 100;
		let score = Math.min(5, Math.max(4, stay.rating + wobble * (index % 2 === 0 ? 1 : 0.6)));
		return { id: category.id, label: category.label, score: Math.round(score * 10) / 10 };
	});
}

/**
 * The share of a stay's reviews at each star, 5 to 1, derived from its rating so the bars and
 * the score agree.
 */
export function starShares(stay: Stay): number[] {
	let five = Math.min(0.97, Math.max(0.5, (stay.rating - 4) * 0.95));
	let four = Math.max(0.02, (1 - five) * 0.72);
	let three = Math.max(0.005, (1 - five - four) * 0.7);
	let two = Math.max(0, (1 - five - four - three) * 0.6);
	return [five, four, three, two, Math.max(0, 1 - five - four - three - two)];
}

/** One saved card the checkout offers. Every one is invented and charges nothing. */
export interface SavedCard {
	id: string;
	brand: string;
	last4: string;
	expires: string;
	holder: string;
	/** The two colours its drawn face blends. */
	tones: [string, string];
}

/**
 * The saved cards checkout picks from. They are fake: Wayfern never asks for, or keeps, a
 * card number, and no payment is made.
 */
export const SAVED_CARDS: SavedCard[] = [
	{
		id: "fern-visa",
		brand: "Visa",
		last4: "4242",
		expires: "08/29",
		holder: "Sam Rivers",
		tones: ["#2f5d4a", "#5f9a72"],
	},
	{
		id: "sky-mastercard",
		brand: "Mastercard",
		last4: "5100",
		expires: "02/28",
		holder: "Sam Rivers",
		tones: ["#30425f", "#6b86b5"],
	},
	{
		id: "dune-amex",
		brand: "Amex",
		last4: "0005",
		expires: "11/27",
		holder: "Sam Rivers",
		tones: ["#7a5a3a", "#c49a62"],
	},
];

/** The signed-in traveller every screen greets. */
export const TRAVELLER = { name: "Sam Rivers", first: "Sam", hues: [150, 190] as [number, number] };

/**
 * A small stable hash of a string, for choosing a stay's reviews and booked nights without
 * randomness, so a page renders the same for every visitor.
 */
export function hashOf(text: string): number {
	let hash = 2166136261;
	for (let index = 0; index < text.length; index++) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

/** Finds a stay by id. */
export function findStay(id: string): Stay | undefined {
	return STAYS.find((stay) => stay.id === id);
}

/** Finds a place by id. */
export function findPlace(id: string): Place | undefined {
	return PLACES.find((place) => place.id === id);
}

/** Finds a host by id. */
export function findHost(id: string): Host | undefined {
	return HOSTS.find((host) => host.id === id);
}

/** Finds a saved card by id. */
export function findCard(id: string): SavedCard | undefined {
	return SAVED_CARDS.find((card) => card.id === id);
}

/**
 * A stay's place, which every stay has.
 *
 * @param stay The stay.
 */
export function placeOf(stay: Stay): Place {
	return findPlace(stay.place) ?? PLACES[0]!;
}

/**
 * A stay's host, which every stay has.
 *
 * @param stay The stay.
 */
export function hostOf(stay: Stay): Host {
	return findHost(stay.host) ?? HOSTS[0]!;
}

/** A label for an amenity id. */
export function amenityLabel(id: Amenity): string {
	return AMENITIES.find((amenity) => amenity.id === id)?.label ?? id;
}

/** A label for a stay type, singular, as a card's eyebrow reads it. */
export function typeLabel(type: StayType): string {
	return {
		cabin: "Cabin",
		cottage: "Cottage",
		loft: "Loft",
		apartment: "Apartment",
		treehouse: "Treehouse",
		farmhouse: "Farmhouse",
	}[type];
}
