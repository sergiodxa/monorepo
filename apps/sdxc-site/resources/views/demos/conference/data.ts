/**
 * Overprint 2027's programme, people and logistics in one place: the sessions the schedule
 * draws, the speakers the grid draws, the ticket tiers, last year's talks, the sponsors and
 * the hotels the map pins, so every band names the same people, rooms and times.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** When the doors open, the moment the hero counts down to: 08:30 in Rotterdam, CEST. */
export const DOORS_OPEN = "2027-04-15T06:30:00Z";

/** The two rooms that run at once, each printed in its own ink. */
export type Track = "main" | "side";

/** The rooms by track, with the ink each one is printed in. */
export const TRACKS: Record<Track, { name: string; room: string; ink: "pink" | "blue" }> = {
	main: { name: "Main stage", room: "Hall A · 600 seats", ink: "pink" },
	side: { name: "Side stage", room: "Hall B · 180 seats", ink: "blue" },
};

/** One person on the programme. */
export interface Speaker {
	/** Anchor and key: `#speaker-<id>` on the grid, `#talk-<id>` on the schedule. */
	id: SpeakerId;
	name: string;
	role: string;
	/** The talk's title, as the schedule prints it. */
	talk: string;
}

/** The twelve speakers by id, in the order the grid sets them: keynotes first. */
const PEOPLE = {
	kwame: {
		name: "Kwame Mensah",
		role: "Staff engineer, Lumen Maps",
		talk: "View transitions between whole pages",
	},
	femke: {
		name: "Femke Visser",
		role: "Creative coder, independent",
		talk: "Scroll-driven animation, no library",
	},
	ines: {
		name: "Ines Okafor",
		role: "Browser engineer, Tallow",
		talk: "Anchor positioning after the hype",
	},
	sanne: {
		name: "Sanne de Wit",
		role: "Accessibility lead, Polder Transit",
		talk: "The popover that passed an audit",
	},
	yuki: {
		name: "Yuki Hasegawa",
		role: "Performance engineer, Tessel",
		talk: "INP from 480 ms to 90 ms",
	},
	lucia: {
		name: "Lucía Ferrer",
		role: "Design engineer, Carta Studio",
		talk: "Type that fits any container",
	},
	matteo: {
		name: "Matteo Bruni",
		role: "CSS consultant, independent",
		talk: "Cascade layers for a team of forty",
	},
	hanna: {
		name: "Hanna Lindgren",
		role: "Engineer, Spoke Health",
		talk: "Forms that survive a train tunnel",
	},
	arjun: {
		name: "Arjun Patel",
		role: "Platform advocate, Halyard",
		talk: "Shipping without a build step",
	},
	amara: {
		name: "Amara Diallo",
		role: "Security engineer, Moorland Bank",
		talk: "Trusted Types in a ten-year-old app",
	},
	daniel: {
		name: "Daniel Kowalski",
		role: "Engineer, Northgate Rail",
		talk: "The Navigation API in production",
	},
	tomas: { name: "Tomás Ríos", role: "Founder, Quire", talk: "Server HTML, streamed in order" },
} as const;

/** A speaker's key, which the schedule names them by. */
export type SpeakerId = keyof typeof PEOPLE;

/** The twelve speakers in grid order. */
export const SPEAKERS: readonly Speaker[] = (Object.keys(PEOPLE) as SpeakerId[]).map((id) => ({
	id,
	...PEOPLE[id],
}));

/** One talk in one room. */
export interface Talk {
	/** Who gives it; the talk takes their title. */
	speaker: SpeakerId;
	minutes: number;
	keynote?: boolean;
}

/**
 * One row of the day: a time, then either a talk per room or one item both rooms share
 * (doors, breaks, lunch, the party).
 */
export type Slot =
	| { time: string; main: Talk; side: Talk | { title: string; note: string } }
	| { time: string; shared: { title: string; note: string } };

/** The day from doors to the party, in Rotterdam time. */
export const SLOTS: readonly Slot[] = [
	{ time: "08:30", shared: { title: "Doors, coffee and badges", note: "Foyer, ground floor" } },
	{ time: "09:15", shared: { title: "Opening", note: "Both rooms, streamed into Hall B" } },
	{
		time: "09:30",
		main: { speaker: "kwame", minutes: 40, keynote: true },
		side: { title: "Opening keynote, live", note: "Streamed from Hall A, with captions" },
	},
	{
		time: "10:20",
		main: { speaker: "ines", minutes: 30 },
		side: { speaker: "sanne", minutes: 30 },
	},
	{ time: "11:00", shared: { title: "Break", note: "Stroopwafels, filter coffee, oat milk" } },
	{
		time: "11:30",
		main: { speaker: "yuki", minutes: 30 },
		side: { speaker: "lucia", minutes: 30 },
	},
	{
		time: "12:10",
		main: { speaker: "matteo", minutes: 30 },
		side: { speaker: "hanna", minutes: 30 },
	},
	{ time: "12:50", shared: { title: "Lunch", note: "Riverside terrace, vegan by default" } },
	{
		time: "14:00",
		main: { speaker: "arjun", minutes: 30 },
		side: { speaker: "amara", minutes: 30 },
	},
	{
		time: "14:40",
		main: { speaker: "daniel", minutes: 30 },
		side: { speaker: "tomas", minutes: 30 },
	},
	{ time: "15:20", shared: { title: "Break", note: "The quiet room stays open all day" } },
	{
		time: "15:50",
		main: { speaker: "femke", minutes: 40, keynote: true },
		side: { title: "Ask the speakers", note: "Ten of the twelve, unscripted" },
	},
	{ time: "16:40", shared: { title: "Closing and raffle", note: "Hall A" } },
	{ time: "17:30", shared: { title: "Party on the quay", note: "Kantine 7, three minutes' walk" } },
];

/** Where a ticket tier stands: gone, the one on sale, or not yet released. */
export type TierState = "sold-out" | "on-sale" | "upcoming";

/** One ticket tier. */
export interface Tier {
	id: string;
	name: string;
	price: number;
	state: TierState;
	/** The release's seats; `left` of them remain. */
	seats: number;
	left: number;
	/** One line on when the tier ran or runs. */
	window: string;
	includes: readonly string[];
}

/**
 * The day's three releases. Only one is ever on sale; the one before it has sold out. With the
 * 40 scholarship seats they fill both halls' 780.
 */
export const TIERS: readonly Tier[] = [
	{
		id: "early",
		name: "Early bird",
		price: 249,
		state: "sold-out",
		seats: 150,
		left: 0,
		window: "Sold out on 2 October, in nine days",
		includes: ["Both stages, all day", "Lunch and the party", "Every talk on video"],
	},
	{
		id: "regular",
		name: "Regular",
		price: 349,
		state: "on-sale",
		seats: 350,
		left: 112,
		window: "On sale until 28 February, or until it runs out",
		includes: ["Both stages, all day", "Lunch and the party", "Every talk on video"],
	},
	{
		id: "late",
		name: "Late",
		price: 429,
		state: "upcoming",
		seats: 240,
		left: 240,
		window: "Released on 1 March, if any seats are left",
		includes: ["Both stages, all day", "Lunch and the party", "Every talk on video"],
	},
];

/** One of last year's recorded talks. */
export interface PastTalk {
	slug: string;
	title: string;
	speaker: string;
	/** Running time as the player prints it. */
	length: string;
}

/** Overprint 2026's talks on video, the most watched first. */
export const PAST_TALKS: readonly PastTalk[] = [
	{
		slug: "the-cascade-is-a-feature",
		title: "The cascade is a feature",
		speaker: "Rosa Lindqvist",
		length: "34:12",
	},
	{
		slug: "container-queries-at-scale",
		title: "Container queries at scale",
		speaker: "Obi Nwosu",
		length: "28:40",
	},
	{ slug: "html-first-forms", title: "HTML-first forms", speaker: "Mei Tanaka", length: "26:05" },
	{ slug: "the-last-spinner", title: "The last spinner", speaker: "Joost Bakker", length: "31:47" },
	{ slug: "color-in-oklch", title: "Colour in OKLCH", speaker: "Priya Raman", length: "24:58" },
	{
		slug: "dialog-not-div",
		title: "<dialog>, not <div>",
		speaker: "Lars Eriksen",
		length: "22:31",
	},
	{
		slug: "fonts-that-load-once",
		title: "Fonts that load once",
		speaker: "Camille Roux",
		length: "29:16",
	},
	{
		slug: "offline-by-default",
		title: "Offline by default",
		speaker: "Tunde Bello",
		length: "33:03",
	},
	{ slug: "one-request-pages", title: "One-request pages", speaker: "Eva Novak", length: "27:39" },
];

/** A sponsor's mark: its name and the shape drawn before it. */
export interface Sponsor {
	name: string;
	glyph: "circle" | "square" | "triangle" | "bars" | "ring" | "diamond";
}

/** The sponsors by tier, largest first. */
export const SPONSORS: Record<"headline" | "partner" | "community", readonly Sponsor[]> = {
	headline: [
		{ name: "Halyard", glyph: "triangle" },
		{ name: "Lumen Maps", glyph: "circle" },
	],
	partner: [
		{ name: "Tessel", glyph: "square" },
		{ name: "Tallow", glyph: "ring" },
		{ name: "Quire", glyph: "bars" },
		{ name: "Northgate", glyph: "diamond" },
	],
	community: [
		{ name: "Polder JS", glyph: "circle" },
		{ name: "CSS Café", glyph: "square" },
		{ name: "Maasweb", glyph: "triangle" },
		{ name: "a11y NL", glyph: "ring" },
		{ name: "Typo Club", glyph: "bars" },
		{ name: "Hackhaven", glyph: "diamond" },
	],
};

/** One hotel with a conference rate, numbered as the map pins it. */
export interface Hotel {
	pin: number;
	name: string;
	walk: string;
	rate: string;
}

/** The three hotels holding rooms at the conference rate until 1 March. */
export const HOTELS: readonly Hotel[] = [
	{ pin: 1, name: "Hotel Kade", walk: "4 min walk", rate: "€139 a night" },
	{ pin: 2, name: "The Dock Rooms", walk: "9 min walk", rate: "€118 a night" },
	{ pin: 3, name: "Stadshotel Noord", walk: "Metro, 12 min", rate: "€96 a night" },
];

/** The speaker an id names, which the schedule's talks are typed to. */
export function speaker(id: SpeakerId): Speaker {
	return { id, ...PEOPLE[id] };
}

/**
 * When and where a speaker is on, read from {@link SLOTS}, so a speaker card always names the
 * slot the schedule prints.
 *
 * @param id The speaker.
 * @returns The slot's start and room, or `undefined` for someone with no talk on the programme.
 */
export function talkSlot(id: SpeakerId): { time: string; track: Track } | undefined {
	for (let slot of SLOTS) {
		if ("shared" in slot) continue;
		if (slot.main.speaker === id) return { time: slot.time, track: "main" };
		if ("speaker" in slot.side && slot.side.speaker === id)
			return { time: slot.time, track: "side" };
	}
	return undefined;
}
