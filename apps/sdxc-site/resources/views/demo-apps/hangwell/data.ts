/**
 * Hangwell's catalogue: invented artists and their posters, the three formats a poster sells
 * in (a print file, a print, a framed print), sizes, frames and their prices, plus seeded
 * reviews, questions, promo codes and shipping. Every figure is integer euro cents.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { formatAmount, percentOf } from "@sdxc/money";
import { createRandom } from "@sdxc/random";

import { demoAppActionHref, demoAppHref } from "~/resources/views/demo-apps";
import routes from "~/routes/web";

/** The demo's folder name and slug. */
export const SLUG = "hangwell";

/** Builds an address inside Hangwell. */
export const href = demoAppHref(SLUG);

/** Builds the address a form posts to. */
export const actionHref = demoAppActionHref(SLUG);

/** Builds the address of a file Hangwell serves, such as a print file to download. */
export function fileHref(part: string): string {
	return routes.showcase.demoFile.href({ slug: SLUG, part });
}

/** Every price is in euros, written the Irish English way (`€45.00`). */
export const CURRENCY = "EUR";

/** The locale prices and dates are written in. */
export const LOCALE = "en-IE";

/** Prices include VAT at the studio's Portuguese rate, which the receipt states. */
export const VAT_PERCENT = 23;

/** A price as text, for a toast, a title or an `<output>`. */
export function money(cents: number): string {
	return formatAmount(cents, CURRENCY, { locale: LOCALE });
}

/** How a poster can be bought. */
export type Format = "digital" | "print" | "framed";

/** A poster's style, the catalogue's main way in. */
export type Style = "geometric" | "botanical" | "travel" | "type" | "maps" | "night";

/** One way in through the menu: a style or a room, with words for its page. */
export interface Collection {
	id: string;
	name: string;
	blurb: string;
	kind: "style" | "room";
}

/** The styles, in menu order. */
export const STYLES: Collection[] = [
	{
		id: "geometric",
		name: "Geometric",
		blurb: "Shapes, grids and bold blocks of colour.",
		kind: "style",
	},
	{
		id: "botanical",
		name: "Botanical",
		blurb: "Leaves, stems and seed heads in fine line.",
		kind: "style",
	},
	{
		id: "travel",
		name: "Travel",
		blurb: "Invented places drawn like old railway posters.",
		kind: "style",
	},
	{ id: "type", name: "Typography", blurb: "Words worth reading every morning.", kind: "style" },
	{
		id: "maps",
		name: "Maps",
		blurb: "Contour lines of hills that only exist on paper.",
		kind: "style",
	},
	{
		id: "night",
		name: "Night sky",
		blurb: "Star charts and moon phases in deep blue.",
		kind: "style",
	},
];

/** The rooms, in menu order. */
export const ROOMS: Collection[] = [
	{ id: "living", name: "Living room", blurb: "Big statements above the sofa.", kind: "room" },
	{
		id: "kitchen",
		name: "Kitchen",
		blurb: "Bright, small and splash-proof in a frame.",
		kind: "room",
	},
	{ id: "bedroom", name: "Bedroom", blurb: "Quiet colour to wake up to.", kind: "room" },
	{ id: "office", name: "Office", blurb: "Something to look at between calls.", kind: "room" },
	{ id: "kids", name: "Kids' room", blurb: "Stars, animals and friendly shapes.", kind: "room" },
];

/** A named paint the posters are printed in; the colour facet lists these. */
export interface Paint {
	id: string;
	name: string;
	color: string;
}

/** The studio's inks, each a colour facet value with its swatch. */
export const PAINTS: Paint[] = [
	{ id: "vermilion", name: "Vermilion", color: "oklch(0.62 0.2 32)" },
	{ id: "ochre", name: "Ochre", color: "oklch(0.76 0.14 75)" },
	{ id: "sage", name: "Sage", color: "oklch(0.72 0.06 145)" },
	{ id: "teal", name: "Teal", color: "oklch(0.55 0.08 200)" },
	{ id: "cobalt", name: "Cobalt", color: "oklch(0.45 0.15 260)" },
	{ id: "rose", name: "Rose", color: "oklch(0.8 0.08 10)" },
	{ id: "ink", name: "Ink", color: "oklch(0.25 0.02 260)" },
	{ id: "sand", name: "Sand", color: "oklch(0.9 0.03 80)" },
];

/** One paint by id. */
export function findPaint(id: string): Paint | undefined {
	return PAINTS.find((paint) => paint.id === id);
}

/** An invented artist the studio prints. */
export interface Artist {
	id: string;
	name: string;
	city: string;
	bio: string;
}

/** The artists, each with a style they are known for. */
export const ARTISTS: Artist[] = [
	{
		id: "ada-lindqvist",
		name: "Ada Lindqvist",
		city: "Gothenburg",
		bio: "Builds every composition from a circle, a square and a ruler she has had since art school.",
	},
	{
		id: "kofi-mensah-ward",
		name: "Kofi Mensah-Ward",
		city: "Leeds",
		bio: "Draws travel posters for towns he made up on long train rides.",
	},
	{
		id: "mirela-szabo",
		name: "Mirela Szabo",
		city: "Pécs",
		bio: "Presses leaves for a week before drawing them in one unbroken line.",
	},
	{
		id: "teo-ballester",
		name: "Teo Ballester",
		city: "Valencia",
		bio: "A sign painter who sets short sentences in big, warm letters.",
	},
	{
		id: "hana-ishikura",
		name: "Hana Ishikura",
		city: "Sapporo",
		bio: "Turns imaginary hills into contour lines, one height every five millimetres.",
	},
	{
		id: "rafael-quintero",
		name: "Rafael Quintero",
		city: "Mérida",
		bio: "Maps skies as they would look from places that don't exist.",
	},
	{
		id: "lotte-van-aken",
		name: "Lotte van Aken",
		city: "Utrecht",
		bio: "Prints overlapping shapes in two inks, the way a risograph would.",
	},
	{
		id: "priya-raman",
		name: "Priya Raman",
		city: "Kochi",
		bio: "Repeats seed pods and petals into calm, even patterns.",
	},
];

/** One artist by id. */
export function findArtist(id: string): Artist | undefined {
	return ARTISTS.find((artist) => artist.id === id);
}

/** A poster's price tier: the base price times this much. */
export type Tier = 1 | 2 | 3;

/** One poster as the shop sells it. */
export interface Poster {
	id: string;
	title: string;
	artist: string;
	style: Style;
	/** The poster's inks; the first is its ground, the rest its shapes. */
	paints: string[];
	orientation: "portrait" | "landscape";
	rooms: string[];
	tier: Tier;
	/** Percent off every format while it's on sale. */
	sale?: number;
	/** The order the "Newest" sort uses; higher came out later. */
	added: number;
	/** The order the "Featured" sort uses; lower shows first. */
	featured: number;
	/** The seed its drawing grows from. */
	seed: number;
	blurb: string;
}

/**
 * The posters. Titles, artists and places are invented; every drawing is generated from the
 * poster's style, inks and seed.
 */
export const POSTERS: Poster[] = [
	{
		id: "ninefold-sun",
		title: "Ninefold Sun",
		artist: "ada-lindqvist",
		style: "geometric",
		paints: ["sand", "vermilion", "ochre", "ink"],
		orientation: "portrait",
		rooms: ["living", "office"],
		tier: 2,
		added: 30,
		featured: 1,
		seed: 11,
		blurb: "Nine arcs of a setting sun, stacked like the rings of a cut tree.",
	},
	{
		id: "quiet-grid",
		title: "Quiet Grid",
		artist: "ada-lindqvist",
		style: "geometric",
		paints: ["sand", "teal", "ochre"],
		orientation: "portrait",
		rooms: ["office", "bedroom"],
		tier: 1,
		added: 12,
		featured: 9,
		seed: 23,
		blurb: "A grid of soft squares, a few of them turned a quarter of the way.",
	},
	{
		id: "half-moons",
		title: "Half Moons",
		artist: "ada-lindqvist",
		style: "geometric",
		paints: ["ink", "rose", "sand"],
		orientation: "landscape",
		rooms: ["living", "bedroom"],
		tier: 2,
		added: 25,
		featured: 6,
		seed: 37,
		blurb: "Half circles stepping across the sheet like a phase chart.",
	},
	{
		id: "two-ink-garden",
		title: "Two-Ink Garden",
		artist: "lotte-van-aken",
		style: "geometric",
		paints: ["sand", "cobalt", "rose"],
		orientation: "portrait",
		rooms: ["kitchen", "kids"],
		tier: 1,
		sale: 20,
		added: 18,
		featured: 12,
		seed: 41,
		blurb: "Blue and pink shapes overlap where a third colour appears by itself.",
	},
	{
		id: "overprint-no-4",
		title: "Overprint No. 4",
		artist: "lotte-van-aken",
		style: "geometric",
		paints: ["sand", "vermilion", "teal"],
		orientation: "portrait",
		rooms: ["office", "living"],
		tier: 2,
		added: 28,
		featured: 4,
		seed: 53,
		blurb: "Four bars of colour printed slightly out of register, on purpose.",
	},
	{
		id: "stacked-stones",
		title: "Stacked Stones",
		artist: "lotte-van-aken",
		style: "geometric",
		paints: ["sage", "ink", "sand"],
		orientation: "portrait",
		rooms: ["bedroom"],
		tier: 1,
		added: 7,
		featured: 18,
		seed: 59,
		blurb: "A cairn of rounded shapes, balanced and very still.",
	},
	{
		id: "fern-study",
		title: "Fern Study",
		artist: "mirela-szabo",
		style: "botanical",
		paints: ["sand", "sage", "ink"],
		orientation: "portrait",
		rooms: ["bedroom", "living"],
		tier: 2,
		added: 29,
		featured: 2,
		seed: 61,
		blurb: "One frond, drawn without lifting the pen.",
	},
	{
		id: "seed-heads",
		title: "Seed Heads",
		artist: "mirela-szabo",
		style: "botanical",
		paints: ["sand", "ochre", "ink"],
		orientation: "portrait",
		rooms: ["kitchen", "living"],
		tier: 1,
		added: 15,
		featured: 10,
		seed: 67,
		blurb: "Grasses gone to seed at the end of August.",
	},
	{
		id: "olive-branch",
		title: "Olive Branch",
		artist: "mirela-szabo",
		style: "botanical",
		paints: ["sage", "ink", "sand"],
		orientation: "landscape",
		rooms: ["kitchen"],
		tier: 1,
		sale: 15,
		added: 9,
		featured: 15,
		seed: 71,
		blurb: "A cutting from a tree older than the farmhouse beside it.",
	},
	{
		id: "pod-repeat",
		title: "Pod Repeat",
		artist: "priya-raman",
		style: "botanical",
		paints: ["rose", "vermilion", "sand"],
		orientation: "portrait",
		rooms: ["kids", "bedroom"],
		tier: 1,
		added: 21,
		featured: 13,
		seed: 73,
		blurb: "Seed pods repeated in a gentle half-drop pattern.",
	},
	{
		id: "monsoon-leaves",
		title: "Monsoon Leaves",
		artist: "priya-raman",
		style: "botanical",
		paints: ["teal", "sage", "sand"],
		orientation: "portrait",
		rooms: ["living", "bedroom"],
		tier: 2,
		added: 27,
		featured: 7,
		seed: 79,
		blurb: "Wide leaves overlapping like the first heavy rain.",
	},
	{
		id: "petal-count",
		title: "Petal Count",
		artist: "priya-raman",
		style: "botanical",
		paints: ["sand", "ochre", "rose"],
		orientation: "portrait",
		rooms: ["kitchen", "kids"],
		tier: 1,
		added: 4,
		featured: 22,
		seed: 83,
		blurb: "Flowers in rows of three, five and eight petals.",
	},
	{
		id: "port-anselm",
		title: "Port Anselm",
		artist: "kofi-mensah-ward",
		style: "travel",
		paints: ["teal", "sand", "vermilion", "ink"],
		orientation: "portrait",
		rooms: ["living", "office"],
		tier: 2,
		added: 26,
		featured: 3,
		seed: 89,
		blurb: "A harbour town of red roofs where the ferry still runs twice a day.",
	},
	{
		id: "the-high-line-to-orvel",
		title: "The High Line to Orvel",
		artist: "kofi-mensah-ward",
		style: "travel",
		paints: ["cobalt", "sand", "ochre"],
		orientation: "portrait",
		rooms: ["office", "living"],
		tier: 3,
		added: 22,
		featured: 8,
		seed: 97,
		blurb: "A mountain railway, drawn as the poster that would have sold its tickets.",
	},
	{
		id: "lake-tessaly",
		title: "Lake Tessaly",
		artist: "kofi-mensah-ward",
		style: "travel",
		paints: ["sage", "teal", "sand"],
		orientation: "landscape",
		rooms: ["bedroom", "living"],
		tier: 2,
		sale: 20,
		added: 14,
		featured: 14,
		seed: 101,
		blurb: "Pines, a jetty and the stillest water in a country that isn't real.",
	},
	{
		id: "sunward-coast",
		title: "Sunward Coast",
		artist: "kofi-mensah-ward",
		style: "travel",
		paints: ["ochre", "vermilion", "cobalt"],
		orientation: "portrait",
		rooms: ["kitchen", "living"],
		tier: 1,
		added: 10,
		featured: 17,
		seed: 103,
		blurb: "Cliffs and a striped lighthouse at the end of the bus line.",
	},
	{
		id: "slow-mornings",
		title: "Slow Mornings",
		artist: "teo-ballester",
		style: "type",
		paints: ["sand", "vermilion", "ink"],
		orientation: "portrait",
		rooms: ["kitchen", "bedroom"],
		tier: 1,
		added: 24,
		featured: 5,
		seed: 107,
		blurb: "Two words in tall, hand-cut letters, for the room you wake up in.",
	},
	{
		id: "make-more-soup",
		title: "Make More Soup",
		artist: "teo-ballester",
		style: "type",
		paints: ["ochre", "ink", "sand"],
		orientation: "portrait",
		rooms: ["kitchen"],
		tier: 1,
		added: 19,
		featured: 11,
		seed: 109,
		blurb: "Kitchen advice that has never once been wrong.",
	},
	{
		id: "nothing-is-urgent",
		title: "Nothing Is Urgent",
		artist: "teo-ballester",
		style: "type",
		paints: ["cobalt", "sand", "rose"],
		orientation: "portrait",
		rooms: ["office"],
		tier: 2,
		added: 16,
		featured: 19,
		seed: 113,
		blurb: "A reminder for the wall behind your screen.",
	},
	{
		id: "be-here-a-while",
		title: "Be Here a While",
		artist: "teo-ballester",
		style: "type",
		paints: ["sage", "ink", "sand"],
		orientation: "landscape",
		rooms: ["living", "bedroom"],
		tier: 1,
		sale: 25,
		added: 6,
		featured: 23,
		seed: 127,
		blurb: "Wide letters that ask nothing of you.",
	},
	{
		id: "korrin-hills",
		title: "Korrin Hills",
		artist: "hana-ishikura",
		style: "maps",
		paints: ["sand", "teal", "ink"],
		orientation: "portrait",
		rooms: ["office", "living"],
		tier: 2,
		added: 23,
		featured: 16,
		seed: 131,
		blurb: "A range of rounded hills, one line for every five metres climbed.",
	},
	{
		id: "valley-of-ise",
		title: "Valley of Ise",
		artist: "hana-ishikura",
		style: "maps",
		paints: ["ink", "ochre", "sand"],
		orientation: "landscape",
		rooms: ["office"],
		tier: 3,
		added: 20,
		featured: 20,
		seed: 137,
		blurb: "Gold contour lines on near-black, like a map lit from below.",
	},
	{
		id: "tarn-and-ridge",
		title: "Tarn and Ridge",
		artist: "hana-ishikura",
		style: "maps",
		paints: ["sage", "cobalt", "sand"],
		orientation: "portrait",
		rooms: ["bedroom", "living"],
		tier: 1,
		added: 11,
		featured: 21,
		seed: 139,
		blurb: "A small mountain lake held by a long, steep ridge.",
	},
	{
		id: "midsummer-sky",
		title: "Midsummer Sky",
		artist: "rafael-quintero",
		style: "night",
		paints: ["cobalt", "ochre", "sand"],
		orientation: "portrait",
		rooms: ["bedroom", "kids"],
		tier: 2,
		added: 17,
		featured: 24,
		seed: 149,
		blurb: "The sky over an invented island at midnight on the longest day.",
	},
	{
		id: "lunar-year",
		title: "Lunar Year",
		artist: "rafael-quintero",
		style: "night",
		paints: ["ink", "sand", "rose"],
		orientation: "landscape",
		rooms: ["living", "office"],
		tier: 3,
		added: 8,
		featured: 25,
		seed: 151,
		blurb: "Every phase of a year's moons in one long row.",
	},
	{
		id: "small-bear",
		title: "Small Bear",
		artist: "rafael-quintero",
		style: "night",
		paints: ["cobalt", "rose", "sand"],
		orientation: "portrait",
		rooms: ["kids", "bedroom"],
		tier: 1,
		added: 13,
		featured: 26,
		seed: 157,
		blurb: "A made-up constellation for the smallest person in the house.",
	},
	{
		id: "orbit-study",
		title: "Orbit Study",
		artist: "rafael-quintero",
		style: "night",
		paints: ["ink", "vermilion", "ochre"],
		orientation: "portrait",
		rooms: ["office", "kids"],
		tier: 2,
		added: 5,
		featured: 27,
		seed: 163,
		blurb: "Planets on their paths, drawn with a compass and patience.",
	},
	{
		id: "tidal-rings",
		title: "Tidal Rings",
		artist: "ada-lindqvist",
		style: "geometric",
		paints: ["teal", "sand", "cobalt"],
		orientation: "portrait",
		rooms: ["bedroom", "office"],
		tier: 1,
		added: 3,
		featured: 28,
		seed: 167,
		blurb: "Rings spreading from a stone dropped in still water.",
	},
	{
		id: "meadow-line",
		title: "Meadow Line",
		artist: "mirela-szabo",
		style: "botanical",
		paints: ["sand", "rose", "sage"],
		orientation: "landscape",
		rooms: ["living", "kitchen"],
		tier: 2,
		added: 2,
		featured: 29,
		seed: 173,
		blurb: "A whole meadow along a single horizon line.",
	},
	{
		id: "keep-the-light-on",
		title: "Keep the Light On",
		artist: "teo-ballester",
		style: "type",
		paints: ["ink", "ochre", "sand"],
		orientation: "portrait",
		rooms: ["living", "bedroom"],
		tier: 2,
		added: 1,
		featured: 30,
		seed: 179,
		blurb: "Warm letters on dark ground, for the hallway.",
	},
];

/** One poster by id. */
export function findPoster(id: string): Poster | undefined {
	return POSTERS.find((poster) => poster.id === id);
}

/** A print size, named for a portrait sheet. */
export interface Size {
	id: string;
	/** Width and height in centimetres, portrait. */
	width: number;
	height: number;
	/** A4 print price; the other formats and tiers scale from it. */
	print: number;
	framed: number;
	/** Framed sizes ship as an oversized parcel and cost more to send. */
	oversize: boolean;
	fits: string;
}

/** The sizes, smallest first. */
export const SIZES: Size[] = [
	{
		id: "a4",
		width: 21,
		height: 29.7,
		print: 1900,
		framed: 5900,
		oversize: false,
		fits: "A shelf, a desk or a gallery wall.",
	},
	{
		id: "a3",
		width: 29.7,
		height: 42,
		print: 2900,
		framed: 7900,
		oversize: false,
		fits: "A hallway or beside a window.",
	},
	{
		id: "50x70",
		width: 50,
		height: 70,
		print: 4500,
		framed: 12900,
		oversize: false,
		fits: "Above a desk or a chest of drawers.",
	},
	{
		id: "70x100",
		width: 70,
		height: 100,
		print: 6900,
		framed: 18900,
		oversize: true,
		fits: "Above a sofa or a bed.",
	},
];

/** One size by id. */
export function findSize(id: string): Size | undefined {
	return SIZES.find((size) => size.id === id);
}

/** A size's name for a poster, turned for a landscape one ("70 × 50 cm"). */
export function sizeName(size: Size, orientation: Poster["orientation"]): string {
	if (size.id === "a4" || size.id === "a3") return size.id.toUpperCase();
	let [a, b] = orientation === "portrait" ? [size.width, size.height] : [size.height, size.width];
	return `${a} × ${b} cm`;
}

/** A frame wood or paint. */
export interface Frame {
	id: string;
	name: string;
	color: string;
	/** Added to a framed print's price. */
	surcharge: number;
}

/** The frames, in the order the picker shows them. */
export const FRAMES: Frame[] = [
	{ id: "oak", name: "Oak", color: "oklch(0.74 0.07 70)", surcharge: 0 },
	{ id: "walnut", name: "Walnut", color: "oklch(0.42 0.05 50)", surcharge: 1500 },
	{ id: "black", name: "Black", color: "oklch(0.22 0.005 260)", surcharge: 0 },
	{ id: "white", name: "White", color: "oklch(0.97 0.004 90)", surcharge: 0 },
];

/** One frame by id. */
export function findFrame(id: string): Frame | undefined {
	return FRAMES.find((frame) => frame.id === id);
}

/** What a white card mount around the print adds to a framed price. */
export const MOUNT_PRICE = 900;

/** The print file's price at every tier. */
export const DIGITAL_PRICE = 1200;

/** Each tier's multiplier, in percent of the base. */
const TIER_PERCENT: Record<Tier, number> = { 1: 100, 2: 125, 3: 160 };

/** One buyable combination of a poster. */
export interface Variant {
	format: Format;
	/** `null` for the print file. */
	size: string | null;
	/** `null` unless framed. */
	frame: string | null;
	mount: boolean;
}

/** The combination a product page opens on: a framed 50 × 70 in oak. */
export const DEFAULT_VARIANT: Variant = {
	format: "framed",
	size: "50x70",
	frame: "oak",
	mount: false,
};

/** Rounds a price to whole euros, so tier prices read like a shop's. */
function roundPrice(cents: number): number {
	return Math.round(cents / 100) * 100;
}

/** A variant's price before any sale. */
export function listPrice(poster: Poster, variant: Variant): number {
	if (variant.format === "digital") return DIGITAL_PRICE;
	let size = findSize(variant.size ?? "") ?? SIZES[0]!;
	let base = variant.format === "print" ? size.print : size.framed;
	let price = roundPrice((base * TIER_PERCENT[poster.tier]) / 100);
	if (variant.format === "framed") {
		price += findFrame(variant.frame ?? "")?.surcharge ?? 0;
		if (variant.mount) price += MOUNT_PRICE;
	}
	return price;
}

/** A variant's price now, with the poster's sale taken off. */
export function salePrice(poster: Poster, variant: Variant): number {
	let list = listPrice(poster, variant);
	return poster.sale === undefined ? list : list - percentOf(list, poster.sale);
}

/** The cheapest physical print of a poster, for "From" on a card and the price facet. */
export function fromPrice(poster: Poster): number {
	return salePrice(poster, { format: "print", size: "a4", frame: null, mount: false });
}

/**
 * How many framed prints of a size are ready to ship. Prints and files are made to order, so
 * only framed stock runs out; a seeded count keeps it stable across visits.
 */
export function framedStock(poster: Poster, size: string): number {
	let random = createRandom(`${poster.seed}:${size}`);
	let roll = random.int(0, 9);
	if (size === "70x100") return roll < 3 ? 0 : roll - 2;
	return roll < 1 ? 0 : roll + 2;
}

/** Whether a variant can be ordered, and how many are left when stock is short. */
export function availability(
	poster: Poster,
	variant: Variant,
): { available: boolean; left: number | null } {
	if (variant.format !== "framed") return { available: true, left: null };
	let left = framedStock(poster, variant.size ?? "");
	return { available: left > 0, left: left > 0 && left <= 3 ? left : null };
}

/** Whether a framed print is on hand in at least one size. */
export function inStock(poster: Poster): boolean {
	return SIZES.some((size) => framedStock(poster, size.id) > 0);
}

/** A variant written for a line or a receipt, such as "50 × 70 cm · Oak frame · Mount". */
export function variantName(poster: Poster, variant: Variant): string {
	if (variant.format === "digital") return "Print file (PDF + JPEG)";
	let size = findSize(variant.size ?? "");
	let parts = [size === undefined ? "" : sizeName(size, poster.orientation)];
	if (variant.format === "print") parts.push("Unframed print");
	else {
		parts.push(`${findFrame(variant.frame ?? "")?.name ?? "Oak"} frame`);
		if (variant.mount) parts.push("Mount");
	}
	return parts.join(" · ");
}

/** A published review. */
export interface Review {
	id: string;
	author: string;
	city: string;
	rating: number;
	title: string;
	body: string;
	/** Days before today it was written. */
	daysAgo: number;
	variant: Variant;
	helpful: number;
}

/** Review openings by rating, so the text agrees with the stars. */
const REVIEW_LINES: Record<number, { title: string; body: string }[]> = {
	5: [
		{
			title: "Even better in person",
			body: "The colours are deeper than on screen and the paper has a lovely soft feel. It arrived flat and perfectly packed.",
		},
		{
			title: "The frame is the real deal",
			body: "Solid wood, proper glass, and the hanging hardware was already fitted. Took two minutes to put up.",
		},
		{
			title: "Bought a second one",
			body: "Got this for my sister and liked it so much I ordered one for my own hallway the same week.",
		},
		{
			title: "Exactly the right size",
			body: "I used the room preview to pick the size and it looks exactly like that above our sofa.",
		},
	],
	4: [
		{
			title: "Lovely print, slow post",
			body: "Really happy with the print itself. Delivery took a couple of days longer than the estimate.",
		},
		{
			title: "Great, size up",
			body: "Beautiful, but I wish I'd gone one size bigger for the wall it's on. The size guide is honest about it.",
		},
		{
			title: "Nice and calm",
			body: "Exactly the quiet piece I wanted for the bedroom. The mount makes a big difference.",
		},
	],
	3: [
		{
			title: "Good, but warmer than I expected",
			body: "The sand ground reads more yellow in my north-facing room. Still a nice piece.",
		},
		{
			title: "Fine for the price",
			body: "Print quality is good. The tube packaging left a slight curl that took a few days to settle.",
		},
	],
	2: [
		{
			title: "Corner was dented",
			body: "The frame arrived with a dented corner. Support sent a new one quickly, but it was a hassle.",
		},
	],
};

/** First names and cities reviewers sign with. */
const REVIEWERS = [
	["Marta", "Porto"],
	["Jonas", "Hamburg"],
	["Aoife", "Galway"],
	["Luca", "Turin"],
	["Sanne", "Leiden"],
	["Tomás", "Seville"],
	["Élise", "Lyon"],
	["Kasia", "Kraków"],
	["Ben", "Bristol"],
	["Inês", "Coimbra"],
	["Mateo", "Bilbao"],
	["Freya", "Aarhus"],
	["Owen", "Cardiff"],
	["Noa", "Ghent"],
	["Ilka", "Tampere"],
] as const;

/** A star rating for a seeded draw: mostly fives, a few low ones, as real shop reviews run. */
function ratingFor(roll: number): number {
	if (roll < 0.6) return 5;
	if (roll < 0.85) return 4;
	return roll < 0.96 ? 3 : 2;
}

/** A poster's reviews, seeded so every visit and test reads the same ones; newest first. */
export function reviewsFor(poster: Poster): Review[] {
	let random = createRandom(`reviews:${poster.seed}`);
	let count = random.int(4, 14);
	let reviews: Review[] = [];
	for (let index = 0; index < count; index += 1) {
		let roll = random.next();
		let rating = ratingFor(roll);
		let line = random.pick(REVIEW_LINES[rating]!);
		let [author, city] = random.pick(REVIEWERS);
		let format = random.pick<Format>(["framed", "framed", "print", "digital"]);
		let size = random.pick(SIZES).id;
		reviews.push({
			id: `${poster.id}-r${index}`,
			author,
			city,
			rating,
			title: line.title,
			body: line.body,
			daysAgo: random.int(2, 400),
			variant: {
				format,
				size: format === "digital" ? null : size,
				frame: format === "framed" ? random.pick(FRAMES).id : null,
				mount: format === "framed" && random.bool(0.3),
			},
			helpful: random.int(0, 24),
		});
	}
	return reviews.sort((a, b) => a.daysAgo - b.daysAgo);
}

/** A poster's average rating to one decimal and how many reviews it has. */
export function ratingOf(poster: Poster): { average: number; count: number } {
	let reviews = reviewsFor(poster);
	let sum = reviews.reduce((total, review) => total + review.rating, 0);
	return { average: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
}

/** A question a shopper asked, with its answers. */
export interface Question {
	id: string;
	question: string;
	daysAgo: number;
	answers: {
		id: string;
		author: string;
		staff: boolean;
		body: string;
		daysAgo: number;
		helpful: number;
	}[];
}

/** Questions most posters get, with the studio's answers. */
const QUESTIONS: Omit<Question, "id">[] = [
	{
		question: "Is the glazing glass or acrylic?",
		daysAgo: 40,
		answers: [
			{
				id: "a1",
				author: "Rita at Hangwell",
				staff: true,
				body: "Framed prints up to 50 × 70 have real glass. 70 × 100 uses shatterproof acrylic so it ships safely.",
				daysAgo: 39,
				helpful: 18,
			},
		],
	},
	{
		question: "Does the frame come with hanging hardware?",
		daysAgo: 85,
		answers: [
			{
				id: "a2",
				author: "Rita at Hangwell",
				staff: true,
				body: "Yes. Every frame has a hanging cord fitted on the back, and A4 and A3 frames also stand on a shelf.",
				daysAgo: 84,
				helpful: 9,
			},
			{
				id: "a3",
				author: "Jonas",
				staff: false,
				body: "Mine came with the cord and two little bumpers for the bottom corners.",
				daysAgo: 70,
				helpful: 4,
			},
		],
	},
	{
		question: "Can I print the file larger than 70 × 100?",
		daysAgo: 120,
		answers: [
			{
				id: "a4",
				author: "Duarte at Hangwell",
				staff: true,
				body: "The print file is made for up to 70 × 100 at 300 dpi. Larger prints will still look good from a distance.",
				daysAgo: 118,
				helpful: 6,
			},
		],
	},
	{
		question: "Is the paper acid-free?",
		daysAgo: 200,
		answers: [
			{
				id: "a5",
				author: "Duarte at Hangwell",
				staff: true,
				body: "Yes, every print is on 230 gsm acid-free matte paper with pigment inks.",
				daysAgo: 199,
				helpful: 11,
			},
		],
	},
];

/** A poster's questions, a seeded selection of the common ones. */
export function questionsFor(poster: Poster): Question[] {
	let random = createRandom(`qa:${poster.seed}`);
	let count = random.int(1, QUESTIONS.length);
	return random
		.shuffle(QUESTIONS)
		.slice(0, count)
		.map((question, index) => ({ ...question, id: `${poster.id}-q${index}` }));
}

/** A promo code the checkout accepts, or one that ended. */
export interface Promo {
	code: string;
	label: string;
	/** Percent off the lines it applies to. */
	percent: number;
	/** Which lines it takes money off. */
	applies: "all" | "framed" | "shipping";
	/** The smallest subtotal it needs, in cents. */
	minimum: number;
	ended?: string;
}

/** The demo's promo codes. */
export const PROMOS: Promo[] = [
	{ code: "WELCOME10", label: "10% off your first order", percent: 10, applies: "all", minimum: 0 },
	{ code: "FRAMED15", label: "15% off framed prints", percent: 15, applies: "framed", minimum: 0 },
	{
		code: "FREESHIP",
		label: "Free standard shipping",
		percent: 100,
		applies: "shipping",
		minimum: 3000,
	},
	{
		code: "SUMMER25",
		label: "Summer sale",
		percent: 25,
		applies: "all",
		minimum: 0,
		ended: "31 August",
	},
];

/** One promo by its code, read case-insensitively. */
export function findPromo(code: string): Promo | undefined {
	let wanted = code.trim().toUpperCase();
	return PROMOS.find((promo) => promo.code === wanted);
}

/** A way to send the physical part of an order. */
export interface ShippingMethod {
	id: string;
	name: string;
	price: number;
	/** Business days from the order, the soonest and the latest. */
	days: [number, number];
	detail: string;
}

/** The shipping methods, cheapest first. */
export const SHIPPING: ShippingMethod[] = [
	{
		id: "standard",
		name: "Standard",
		price: 490,
		days: [3, 5],
		detail: "Tracked, in a tube or a flat box.",
	},
	{ id: "express", name: "Express", price: 1290, days: [1, 2], detail: "Tracked, signed for." },
	{
		id: "pickup",
		name: "Pick up at the studio",
		price: 0,
		days: [1, 1],
		detail: "Rua das Flores, Porto. Ready the next working day.",
	},
];

/** One shipping method by id. */
export function findShipping(id: string): ShippingMethod | undefined {
	return SHIPPING.find((method) => method.id === id);
}

/** Standard shipping is free once the physical part of a cart reaches this. */
export const FREE_SHIPPING_FROM = 7500;

/** Added to shipping when a cart holds a framed 70 × 100. */
export const OVERSIZE_FEE = 1500;

/** A demo way to pay; no card numbers are ever asked for. */
export interface PaymentMethod {
	id: string;
	name: string;
	detail: string;
}

/** The demo payment methods. */
export const PAYMENTS: PaymentMethod[] = [
	{
		id: "demo-card",
		name: "Demo card •• 4242",
		detail: "A pretend card already on file. Nothing is charged.",
	},
	{ id: "demo-wallet", name: "Demo Pay", detail: "A pretend wallet that approves every order." },
	{
		id: "gift",
		name: "Gift card",
		detail: "Pays with the demo gift card HANG-GIFT-50 and its €50 balance.",
	},
];

/** One payment method by id. */
export function findPayment(id: string): PaymentMethod | undefined {
	return PAYMENTS.find((method) => method.id === id);
}

/** The countries checkout ships to. */
export const COUNTRIES = [
	{ id: "PT", name: "Portugal" },
	{ id: "ES", name: "Spain" },
	{ id: "FR", name: "France" },
	{ id: "DE", name: "Germany" },
	{ id: "NL", name: "Netherlands" },
	{ id: "IE", name: "Ireland" },
	{ id: "IT", name: "Italy" },
] as const;

/** One country's name by its code. */
export function countryName(id: string): string | undefined {
	return COUNTRIES.find((country) => country.id === id)?.name;
}

/** The demo shopper, who is signed in on every visit. */
export const SHOPPER = { name: "Maya Okafor", email: "maya@example.com" };

/** A saved address. */
export interface Address {
	id: string;
	name: string;
	line1: string;
	line2: string;
	city: string;
	postcode: string;
	country: string;
}

/** The shopper's saved addresses before they change anything. */
export const SEED_ADDRESSES: Address[] = [
	{
		id: "home",
		name: "Maya Okafor",
		line1: "Rua de Cedofeita 214",
		line2: "3º esq.",
		city: "Porto",
		postcode: "4050-174",
		country: "PT",
	},
	{
		id: "studio",
		name: "Maya Okafor",
		line1: "Calle de la Paz 9",
		line2: "",
		city: "Valencia",
		postcode: "46003",
		country: "ES",
	},
];

/** A short line for an address, such as "Rua de Cedofeita 214, Porto". */
export function addressLine(address: Address): string {
	return [
		address.line1,
		address.line2,
		`${address.postcode} ${address.city}`,
		countryName(address.country),
	]
		.filter((part) => part !== undefined && part !== "")
		.join(", ");
}

/** Cities the address field suggests, so the demo's autocomplete has something to offer. */
export const CITIES = [
	"Porto",
	"Lisbon",
	"Coimbra",
	"Braga",
	"Valencia",
	"Madrid",
	"Seville",
	"Lyon",
	"Paris",
	"Berlin",
	"Hamburg",
	"Amsterdam",
	"Utrecht",
	"Dublin",
	"Galway",
	"Milan",
	"Turin",
];
