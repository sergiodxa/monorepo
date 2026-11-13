/**
 * Chorus's fixture data: invented people, their posts with pictures, link cards, quotes,
 * polls and threads, the trends, and the notifications of Noor Haddad, the signed-in
 * person. Every screen reads from here, so counts on one page match counts on the next.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoAppActionHref, demoAppFrameHref, demoAppHref } from "~/resources/views/demo-apps";

/** Chorus's addresses, keyed by page path under the app. */
export const href = demoAppHref("chorus");

/** Where Chorus's forms post, keyed by the page path the form acts on. */
export const actionHref = demoAppActionHref("chorus");

/** Chorus's frame addresses. */
export const frameHref = demoAppFrameHref("chorus");

/** The prefix of a poll's own frame, which a vote reloads alone. */
export const POLL_FRAME_PREFIX = "chorus-poll-";

/**
 * The name of one post's poll frame.
 *
 * @param id The post's id.
 */
export function pollFrame(id: string): string {
	return `${POLL_FRAME_PREFIX}${id}`;
}

/** The moment fixture times read against, so "2h" never drifts. */
export const NOW = "2026-11-12T15:00:00Z";

/** The most characters a post takes. */
export const POST_LIMIT = 280;

/** One person on Chorus. `hue` tints their initials tile and their banner. */
export interface Person {
	handle: string;
	name: string;
	initials: string;
	hue: number;
	bio: string;
	location?: string;
	/** A site shown on the profile, without its scheme. */
	site?: string;
	/** "March 2021", as the profile prints it. */
	joined: string;
	followers: number;
	following: number;
	/** Whether Noor follows them before the visitor changes anything. */
	followed: boolean;
	/** Whether they follow Noor, shown as "Follows you". */
	followsYou?: boolean;
	/** An organisation's account, drawn with a rounded-square tile. */
	org?: boolean;
}

/** A picture in a post, drawn as a generated scene; `alt` is what a screen reader hears. */
export interface Picture {
	scene: Scene;
	alt: string;
}

/** The generated scenes a picture or a link card's image draws. */
export type Scene =
	| "night-sky"
	| "dunes"
	| "harbor"
	| "plates"
	| "rails"
	| "sketch"
	| "forest"
	| "chart";

/** A link preview: the page's site, title and summary under its image. */
export interface LinkCard {
	url: string;
	domain: string;
	title: string;
	description: string;
	scene: Scene;
}

/** A poll's options with the votes each had before the visitor's. */
export interface Poll {
	options: string[];
	votes: number[];
	/** "6h left" while open; `undefined` once it ended. */
	endsIn?: string;
}

/** One post. A `replyTo` makes it a reply; a reply by the same author continues a thread. */
export interface Post {
	id: string;
	author: string;
	text: string;
	at: string;
	pictures?: Picture[];
	link?: LinkCard;
	/** The post this one quotes. */
	quote?: string;
	poll?: Poll;
	replyTo?: string;
	replies: number;
	reposts: number;
	likes: number;
	views: number;
	/** Whether Noor had liked, reposted or saved it before the visitor changes anything. */
	liked?: boolean;
	reposted?: boolean;
	saved?: boolean;
	/** Whether Noor had voted, and for which option, in its poll. */
	voted?: number;
}

/** One trend in the right rail and on Explore. */
export interface Trend {
	topic: string;
	/** "Science · Trending", the line above the topic. */
	context: string;
	posts: number;
	/** What Explore searches for when the trend is opened. */
	query: string;
}

/** One entry of the For you timeline: a post, or a post someone reposted into it. */
export interface TimelineEntry {
	post: string;
	repostedBy?: string;
}

/** What a notification is about. */
export type NotificationKind = "like" | "repost" | "follow" | "reply" | "mention" | "post";

/** One notification; likes, reposts and follows group several people under one line. */
export interface Notification {
	id: string;
	kind: NotificationKind;
	/** Who acted, the first shown by name; `others` counts the people not listed. */
	people: string[];
	others?: number;
	/** The post acted on, or the reply or mention itself. */
	post?: string;
	at: string;
	unread?: boolean;
}

/** The signed-in person. */
export const ME: Person = {
	handle: "noorhaddad",
	name: "Noor Haddad",
	initials: "NH",
	hue: 25,
	bio: "Front-end engineer. I write about CSS, forms and the small web. Slow runner, fast reader.",
	location: "Amman · Lisbon",
	site: "noor.example",
	joined: "March 2021",
	followers: 1284,
	following: 312,
	followed: false,
};

/** Everyone else Chorus shows. */
export const PEOPLE: Person[] = [
	{
		handle: "anasousa",
		name: "Ana Sousa",
		initials: "AS",
		hue: 350,
		bio: "Product designer in Lisbon. Forms, tables and the boring parts that make apps feel calm.",
		location: "Lisbon",
		site: "anasousa.design",
		joined: "June 2019",
		followers: 8421,
		following: 604,
		followed: true,
		followsYou: true,
	},
	{
		handle: "priyacodes",
		name: "Priya Raman",
		initials: "PR",
		hue: 265,
		bio: "Browser engineer. Layout, text and the CSS you didn't know shipped. Threads about the platform.",
		location: "Bengaluru",
		joined: "January 2018",
		followers: 23900,
		following: 410,
		followed: true,
	},
	{
		handle: "kofibuilds",
		name: "Kofi Mensah",
		initials: "KM",
		hue: 140,
		bio: "Building a one-person invoicing app in public. Posts numbers every Friday.",
		location: "Accra",
		site: "ledgerly.app",
		joined: "August 2022",
		followers: 5310,
		following: 890,
		followed: true,
		followsYou: true,
	},
	{
		handle: "meilin",
		name: "Mei Lin",
		initials: "ML",
		hue: 230,
		bio: "Astrophotographer. Dark skies, long exposures, cold hands.",
		location: "Tekapo",
		joined: "February 2020",
		followers: 41200,
		following: 188,
		followed: true,
	},
	{
		handle: "rafaortiz",
		name: "Rafael Ortiz",
		initials: "RO",
		hue: 45,
		bio: "Chef at a twelve-seat counter. Menus change when the market does.",
		location: "Oaxaca",
		joined: "May 2017",
		followers: 12800,
		following: 520,
		followed: false,
	},
	{
		handle: "tnovak",
		name: "Tomás Novák",
		initials: "TN",
		hue: 195,
		bio: "Urbanist. Night trains, bike lanes and the timetables that connect them.",
		location: "Vienna",
		joined: "October 2016",
		followers: 9700,
		following: 1200,
		followed: true,
		followsYou: true,
	},
	{
		handle: "hanasato",
		name: "Hana Sato",
		initials: "HS",
		hue: 320,
		bio: "Illustrator. Small animals with big opinions. Commissions open in spring.",
		location: "Osaka",
		site: "hanasato.art",
		joined: "April 2019",
		followers: 67400,
		following: 301,
		followed: false,
		followsYou: true,
	},
	{
		handle: "elifreads",
		name: "Elif Kaya",
		initials: "EK",
		hue: 10,
		bio: "Reading a book a week and telling you about it. Translator by day.",
		location: "Istanbul",
		joined: "September 2020",
		followers: 3150,
		following: 760,
		followed: false,
	},
	{
		handle: "jonahbrooks",
		name: "Jonah Brooks",
		initials: "JB",
		hue: 160,
		bio: "Climate reporter. Heat pumps, grids and the people installing them.",
		location: "Leeds",
		site: "groundline.news",
		joined: "November 2015",
		followers: 18900,
		following: 1540,
		followed: false,
	},
	{
		handle: "solmendes",
		name: "Sol Mendes",
		initials: "SM",
		hue: 290,
		bio: "Bass player. Making a record in a garage, one take at a time.",
		location: "Porto Alegre",
		joined: "July 2021",
		followers: 2210,
		following: 480,
		followed: false,
		followsYou: true,
	},
	{
		handle: "graceokoro",
		name: "Grace Okoro",
		initials: "GO",
		hue: 75,
		bio: "Running coach. Easy miles, honest splits, rest days count.",
		location: "Lagos",
		joined: "March 2018",
		followers: 15600,
		following: 330,
		followed: true,
	},
	{
		handle: "lumenwx",
		name: "Lumen Weather",
		initials: "LW",
		hue: 210,
		bio: "Forecasts for people who look up. Cloud cover, seeing and moonrise, every evening.",
		site: "lumenwx.example",
		joined: "December 2014",
		followers: 128000,
		following: 12,
		followed: false,
		org: true,
	},
];

/** Every person, Noor first. */
export const EVERYONE: Person[] = [ME, ...PEOPLE];

/**
 * Finds a person by handle.
 *
 * @param handle The handle without its `@`, matched case-insensitively.
 * @returns The person, or `undefined` for a handle no one has.
 */
export function findPerson(handle: string): Person | undefined {
	let wanted = handle.toLowerCase();
	return EVERYONE.find((person) => person.handle === wanted);
}

/** Every post, newest first within each author's story; threads and replies included. */
export const POSTS: Post[] = [
	{
		id: "p-leonids",
		author: "meilin",
		text: "Leonids peak on the night of the 17th and the forecast for the lake is clear for once. Last year's best frame, 40 minutes stacked. If you're under dark skies, look east after 1am. #Leonids",
		at: "2026-11-12T13:12:00Z",
		pictures: [
			{
				scene: "night-sky",
				alt: "A long exposure over a lake: star trails arc above dark hills, crossed by three bright meteor streaks.",
			},
		],
		replies: 3,
		reposts: 412,
		likes: 3820,
		views: 98400,
		liked: true,
	},
	{
		id: "p-fieldsizing",
		author: "priyacodes",
		text: "A thread on the one CSS line that deletes most auto-growing textarea scripts: `field-sizing: content`. 🧵",
		at: "2026-11-12T12:40:00Z",
		replies: 2,
		reposts: 860,
		likes: 4120,
		views: 152000,
		saved: true,
	},
	{
		id: "p-fieldsizing-2",
		author: "priyacodes",
		replyTo: "p-fieldsizing",
		text: "It makes a field size to its content, like an inline element would. Pair it with min-block-size and max-block-size and you get a box that grows from one line to twelve, then scrolls.",
		at: "2026-11-12T12:41:00Z",
		replies: 1,
		reposts: 120,
		likes: 980,
		views: 61000,
	},
	{
		id: "p-fieldsizing-3",
		author: "priyacodes",
		replyTo: "p-fieldsizing-2",
		text: "It works on inputs and selects too. A select that is exactly as wide as its chosen option is a nice detail in a filter bar. Support is good in Chromium today; elsewhere it falls back to a fixed size, which is what you had anyway.",
		at: "2026-11-12T12:43:00Z",
		replies: 0,
		reposts: 96,
		likes: 1210,
		views: 58000,
	},
	{
		id: "p-friday-poll",
		author: "kofibuilds",
		text: "Solo founders: what do you ship on a Friday afternoon?",
		at: "2026-11-12T11:05:00Z",
		poll: {
			options: [
				"Nothing. Fridays are for reading",
				"Copy and docs only",
				"Anything with a flag",
				"Straight to production",
			],
			votes: [412, 288, 507, 196],
			endsIn: "18h left",
		},
		replies: 2,
		reposts: 31,
		likes: 264,
		views: 22100,
	},
	{
		id: "p-heatpumps",
		author: "jonahbrooks",
		text: "Installers in three counties told me the same thing: the waiting list is now longer for the electrician than for the heat pump. New piece on the grid connections nobody planned for.",
		at: "2026-11-12T10:20:00Z",
		link: {
			url: "https://groundline.news/2026/11/the-queue-behind-the-heat-pump",
			domain: "groundline.news",
			title: "The queue behind the heat pump",
			description:
				"Households are ready to switch. The street's cable isn't. Inside the year-long wait for a bigger fuse.",
			scene: "chart",
		},
		replies: 1,
		reposts: 233,
		likes: 1450,
		views: 47800,
	},
	{
		id: "p-ana-quote",
		author: "anasousa",
		quote: "p-fieldsizing",
		text: "If you change one thing in your forms this year, make it this. A comment box that grows as people write tells them it is fine to write more.",
		at: "2026-11-12T09:58:00Z",
		replies: 1,
		reposts: 74,
		likes: 690,
		views: 18300,
	},
	{
		id: "p-menu",
		author: "rafaortiz",
		text: "This week's counter: smoked squash with pepita mole, and a tamal of black beans and hoja santa. The market had the best chiles of the year, so dessert is chocolate with pasilla.",
		at: "2026-11-12T08:30:00Z",
		pictures: [
			{
				scene: "plates",
				alt: "Three shallow bowls on a dark wooden counter, each with a deep red sauce and green herbs.",
			},
			{
				scene: "dunes",
				alt: "Dried chiles piled in warm orange and brown folds at a market stall.",
			},
		],
		replies: 1,
		reposts: 58,
		likes: 940,
		views: 21000,
	},
	{
		id: "p-nighttrain",
		author: "tnovak",
		text: "Booked Vienna to Amsterdam on the sleeper for December. 14 hours, a real bed, breakfast at the border, no airport. The new couchettes have a lock and a USB port, which is apparently all I need from life now.",
		at: "2026-11-12T07:45:00Z",
		link: {
			url: "https://railwise.example/routes/vienna-amsterdam",
			domain: "railwise.example",
			title: "Vienna to Amsterdam by night train",
			description:
				"Times, carriages and how to book the couchette with a lock, updated for the winter timetable.",
			scene: "rails",
		},
		replies: 2,
		reposts: 140,
		likes: 1980,
		views: 39700,
	},
	{
		id: "p-otter",
		author: "hanasato",
		text: "An otter who has strong feelings about your sourdough starter. Prints of this one are back next week.",
		at: "2026-11-11T22:10:00Z",
		pictures: [
			{
				scene: "sketch",
				alt: "An ink-and-wash illustration of an otter peering into a jar, its whiskers bristling.",
			},
		],
		replies: 0,
		reposts: 1210,
		likes: 18400,
		views: 302000,
		liked: true,
	},
	{
		id: "p-weather",
		author: "lumenwx",
		text: "Tonight: clear across the southern lakes from 21:00, seeing good, moon sets 02:14. Patchy cloud along the coast clears by midnight. Best window for the Leonids is still the 17th.",
		at: "2026-11-11T19:00:00Z",
		replies: 0,
		reposts: 320,
		likes: 2100,
		views: 76000,
	},
	{
		id: "p-pace-poll",
		author: "graceokoro",
		text: "Results are in. Most of you run your easy days too fast, and I say that with love.",
		at: "2026-11-11T17:20:00Z",
		poll: {
			options: ["Truly easy, can chat", "Moderate, short sentences", "Same as race pace"],
			votes: [1340, 2210, 870],
		},
		replies: 0,
		reposts: 90,
		likes: 1120,
		views: 34000,
		voted: 0,
	},
	{
		id: "p-book",
		author: "elifreads",
		text: "Finished a novel told entirely in the minutes of a village council. I laughed, then I cried at an agenda item about a bus shelter. Fifty pages in, I'd have told you that was impossible.",
		at: "2026-11-11T15:40:00Z",
		replies: 0,
		reposts: 44,
		likes: 610,
		views: 9800,
	},
	{
		id: "p-record",
		author: "solmendes",
		text: "Track four is done. One take, one microphone, a neighbour's dog in the last chorus that we decided to keep.",
		at: "2026-11-11T12:15:00Z",
		link: {
			url: "https://tidewater.example/solmendes/garage-sessions",
			domain: "tidewater.example",
			title: "Garage Sessions, track 4: Low Tide",
			description: "Sol Mendes on bass, recorded live in Porto Alegre. 4:12.",
			scene: "harbor",
		},
		replies: 0,
		reposts: 12,
		likes: 188,
		views: 3100,
	},
	{
		id: "p-noor-forms",
		author: "noorhaddad",
		text: "Wrote up how we cut our sign-up form from nine fields to three without losing anything the sales team needed. Most of it was asking later, not asking less.",
		at: "2026-11-12T06:30:00Z",
		link: {
			url: "https://noor.example/notes/three-fields",
			domain: "noor.example",
			title: "Three fields",
			description: "How a nine-field sign-up became three, and where the other six went.",
			scene: "forest",
		},
		replies: 2,
		reposts: 37,
		likes: 412,
		views: 12800,
	},
	{
		id: "p-noor-css",
		author: "noorhaddad",
		text: "Small joy: `text-wrap: balance` on every heading, and a whole design review's worth of awkward one-word last lines just went away.",
		at: "2026-11-10T18:05:00Z",
		replies: 0,
		reposts: 22,
		likes: 309,
		views: 8400,
	},
	{
		id: "p-noor-run",
		author: "noorhaddad",
		text: "Easy 8k along the river this morning. Did not check the pace once. @graceokoro would be proud.",
		at: "2026-11-09T07:50:00Z",
		pictures: [
			{
				scene: "forest",
				alt: "A riverside path at dawn under tall trees, mist low over the water.",
			},
		],
		replies: 1,
		reposts: 3,
		likes: 96,
		views: 2400,
	},
	{
		id: "r-leonids-1",
		author: "lumenwx",
		replyTo: "p-leonids",
		text: "Seeing looks excellent around the lake on the 17th. Cloud arrives from the west after 05:00, so the hours before dawn are your window.",
		at: "2026-11-12T13:30:00Z",
		replies: 0,
		reposts: 18,
		likes: 260,
		views: 9100,
	},
	{
		id: "r-leonids-2",
		author: "tnovak",
		replyTo: "p-leonids",
		text: "Forty minutes in that cold deserves a medal. What lens was this?",
		at: "2026-11-12T13:41:00Z",
		replies: 1,
		reposts: 0,
		likes: 34,
		views: 2900,
	},
	{
		id: "r-leonids-3",
		author: "meilin",
		replyTo: "r-leonids-2",
		text: "14mm at f/2.8, ISO 1600, 20-second frames. The trick is a lens heater strip, or the dew wins by midnight.",
		at: "2026-11-12T13:52:00Z",
		replies: 0,
		reposts: 2,
		likes: 88,
		views: 2400,
	},
	{
		id: "r-fieldsizing-1",
		author: "anasousa",
		replyTo: "p-fieldsizing-3",
		text: "The select one is lovely. We shipped it in a filter bar last month and nobody noticed, which is the point.",
		at: "2026-11-12T12:58:00Z",
		replies: 0,
		reposts: 1,
		likes: 140,
		views: 6100,
	},
	{
		id: "r-poll-1",
		author: "anasousa",
		replyTo: "p-friday-poll",
		text: "Copy and docs. A typo fix on Friday has never ruined a weekend.",
		at: "2026-11-12T11:20:00Z",
		replies: 0,
		reposts: 0,
		likes: 41,
		views: 1800,
	},
	{
		id: "r-poll-2",
		author: "tnovak",
		replyTo: "p-friday-poll",
		text: "Anything behind a flag, and the flag stays off until Monday.",
		at: "2026-11-12T11:34:00Z",
		replies: 0,
		reposts: 0,
		likes: 29,
		views: 1500,
	},
	{
		id: "r-heatpumps-1",
		author: "kofibuilds",
		replyTo: "p-heatpumps",
		text: "Same story with solar here: the panels arrive in a week, the utility's paperwork in three months.",
		at: "2026-11-12T10:40:00Z",
		replies: 0,
		reposts: 4,
		likes: 66,
		views: 2300,
	},
	{
		id: "r-ana-quote-1",
		author: "priyacodes",
		replyTo: "p-ana-quote",
		text: "That's exactly it. The size of a box is an instruction.",
		at: "2026-11-12T10:12:00Z",
		replies: 0,
		reposts: 3,
		likes: 120,
		views: 4100,
	},
	{
		id: "r-menu-1",
		author: "elifreads",
		replyTo: "p-menu",
		text: "Booking the moment I'm in Oaxaca. Is the pasilla dessert staying through December?",
		at: "2026-11-12T08:50:00Z",
		replies: 0,
		reposts: 0,
		likes: 12,
		views: 900,
	},
	{
		id: "r-train-1",
		author: "anasousa",
		replyTo: "p-nighttrain",
		text: "The lock is the whole upgrade. I'd pay double for the lock.",
		at: "2026-11-12T08:02:00Z",
		replies: 0,
		reposts: 0,
		likes: 77,
		views: 3200,
	},
	{
		id: "r-train-2",
		author: "noorhaddad",
		replyTo: "p-nighttrain",
		text: "Did Lisbon to Madrid on the old sleeper years ago and still think about the breakfast. Enjoy it.",
		at: "2026-11-12T08:15:00Z",
		replies: 0,
		reposts: 0,
		likes: 23,
		views: 1100,
	},
	{
		id: "r-noor-forms-1",
		author: "jonahbrooks",
		replyTo: "p-noor-forms",
		text: "Bookmarking for our subscriptions page, which currently asks for your postcode twice.",
		at: "2026-11-12T07:10:00Z",
		replies: 0,
		reposts: 0,
		likes: 18,
		views: 700,
	},
	{
		id: "r-noor-forms-2",
		author: "anasousa",
		replyTo: "p-noor-forms",
		text: "“Asking later, not asking less” is going on the studio wall.",
		at: "2026-11-12T07:25:00Z",
		replies: 0,
		reposts: 2,
		likes: 54,
		views: 1300,
	},
	{
		id: "r-noor-run-1",
		author: "graceokoro",
		replyTo: "p-noor-run",
		text: "Very proud. Now do it again on Thursday.",
		at: "2026-11-09T09:12:00Z",
		replies: 0,
		reposts: 0,
		likes: 31,
		views: 600,
	},
	{
		id: "m-elif",
		author: "elifreads",
		text: "Recommendation thread for people who liked the council-minutes novel, starting with @noorhaddad's pick from last week, which I finally read and loved.",
		at: "2026-11-12T09:15:00Z",
		replies: 0,
		reposts: 6,
		likes: 72,
		views: 2100,
	},
];

/**
 * Finds a post by id.
 *
 * @param id The post's id.
 * @returns The post, or `undefined` for an id no fixture has.
 */
export function findPost(id: string): Post | undefined {
	return POSTS.find((post) => post.id === id);
}

/** The For you timeline, top first: what a visitor reads on arriving. */
export const FOR_YOU: TimelineEntry[] = [
	{ post: "p-leonids" },
	{ post: "p-fieldsizing" },
	{ post: "p-friday-poll" },
	{ post: "p-heatpumps" },
	{ post: "p-ana-quote" },
	{ post: "p-otter", repostedBy: "anasousa" },
	{ post: "p-menu" },
	{ post: "p-nighttrain" },
	{ post: "p-weather" },
	{ post: "p-pace-poll" },
	{ post: "p-book" },
	{ post: "p-record" },
];

/**
 * Posts that arrive while a visitor reads, in the order they land: the "Show N new posts"
 * pill reveals the first batch, then the second.
 */
export const ARRIVALS: Post[][] = [
	[
		{
			id: "a-ferry",
			author: "tnovak",
			text: "Update: the ferry strike is off, the 18:40 crossing runs tonight. Plenty of seats on the late one too.",
			at: "2026-11-12T14:58:00Z",
			replies: 0,
			reposts: 14,
			likes: 51,
			views: 1200,
		},
		{
			id: "a-friday-numbers",
			author: "kofibuilds",
			text: "Friday numbers, a day early because I'm offline tomorrow: 412 paying teams, churn 1.8%, and the first customer in Iceland. Hello, Reykjavík.",
			at: "2026-11-12T14:55:00Z",
			replies: 0,
			reposts: 22,
			likes: 340,
			views: 5400,
		},
		{
			id: "a-sketch",
			author: "hanasato",
			text: "Warm-up sketch: a heron who has seen your browser tabs and is disappointed.",
			at: "2026-11-12T14:52:00Z",
			pictures: [
				{
					scene: "sketch",
					alt: "A loose ink sketch of a tall heron glaring sideways, one leg raised.",
				},
			],
			replies: 0,
			reposts: 380,
			likes: 6200,
			views: 41000,
		},
	],
	[
		{
			id: "a-clouds",
			author: "lumenwx",
			text: "Cloud update for the lakes: the gap tonight now opens at 20:30, half an hour earlier than forecast this morning.",
			at: "2026-11-12T14:59:00Z",
			replies: 0,
			reposts: 40,
			likes: 290,
			views: 8800,
		},
		{
			id: "a-container",
			author: "priyacodes",
			text: "Container style queries let a card ask what theme its parent set, without a class in sight. Thread tomorrow.",
			at: "2026-11-12T14:57:00Z",
			replies: 0,
			reposts: 88,
			likes: 760,
			views: 12000,
		},
	],
];

/** Every arrival, flat, for lookups by id. */
export const ARRIVED_POSTS: Post[] = ARRIVALS.flat();

/** The trends, in the order the rail ranks them. */
export const TRENDS: Trend[] = [
	{ topic: "#Leonids", context: "Science · Trending", posts: 12400, query: "#Leonids" },
	{ topic: "field-sizing", context: "Technology · Trending", posts: 4210, query: "field-sizing" },
	{ topic: "Night trains", context: "Travel · Trending", posts: 8930, query: "train" },
	{ topic: "Heat pumps", context: "Climate · Trending", posts: 3870, query: "heat pump" },
	{ topic: "Ferry strike", context: "Trending in Vienna", posts: 1960, query: "ferry" },
	{ topic: "Sourdough", context: "Food · Trending", posts: 15800, query: "sourdough" },
	{ topic: "Easy runs", context: "Sports · Trending", posts: 2640, query: "easy" },
];

/** Noor's notifications, newest first. */
export const NOTIFICATIONS: Notification[] = [
	{
		id: "n-likes-forms",
		kind: "like",
		people: ["anasousa", "kofibuilds", "priyacodes", "tnovak"],
		others: 0,
		post: "p-noor-forms",
		at: "2026-11-12T14:20:00Z",
		unread: true,
	},
	{
		id: "n-post-mei",
		kind: "post",
		people: ["meilin"],
		post: "p-leonids",
		at: "2026-11-12T13:12:00Z",
		unread: true,
	},
	{
		id: "n-mention-elif",
		kind: "mention",
		people: ["elifreads"],
		post: "m-elif",
		at: "2026-11-12T09:15:00Z",
		unread: true,
	},
	{
		id: "n-reposts-forms",
		kind: "repost",
		people: ["anasousa", "priyacodes"],
		others: 35,
		post: "p-noor-forms",
		at: "2026-11-12T07:30:00Z",
	},
	{
		id: "n-reply-ana",
		kind: "reply",
		people: ["anasousa"],
		post: "r-noor-forms-2",
		at: "2026-11-12T07:25:00Z",
	},
	{
		id: "n-reply-jonah",
		kind: "reply",
		people: ["jonahbrooks"],
		post: "r-noor-forms-1",
		at: "2026-11-12T07:10:00Z",
	},
	{
		id: "n-follows",
		kind: "follow",
		people: ["hanasato", "solmendes"],
		at: "2026-11-12T05:40:00Z",
	},
	{
		id: "n-likes-css",
		kind: "like",
		people: ["meilin", "graceokoro", "rafaortiz"],
		others: 306,
		post: "p-noor-css",
		at: "2026-11-11T09:00:00Z",
	},
	{
		id: "n-reply-grace",
		kind: "reply",
		people: ["graceokoro"],
		post: "r-noor-run-1",
		at: "2026-11-09T09:12:00Z",
	},
	{
		id: "n-follow-elif",
		kind: "follow",
		people: ["elifreads"],
		at: "2026-11-08T16:00:00Z",
	},
];

/** One message in a conversation; `from` is a handle, Noor's own included. */
export interface Message {
	from: string;
	text: string;
	at: string;
}

/** One conversation in Messages, with the person on the other side. */
export interface Conversation {
	with: string;
	messages: Message[];
}

/** Noor's conversations, the most recent first. */
export const CONVERSATIONS: Conversation[] = [
	{
		with: "anasousa",
		messages: [
			{
				from: "anasousa",
				text: "Are you around for the forms talk on Thursday? I saved you a seat.",
				at: "2026-11-12T13:40:00Z",
			},
			{
				from: "noorhaddad",
				text: "Yes! I'll bring the before and after of the sign-up page.",
				at: "2026-11-12T13:52:00Z",
			},
			{
				from: "anasousa",
				text: "Perfect. The three-fields one is going to get a round of applause.",
				at: "2026-11-12T14:05:00Z",
			},
		],
	},
	{
		with: "kofibuilds",
		messages: [
			{
				from: "kofibuilds",
				text: "Quick one: would you review my invoice form before I ship it Friday?",
				at: "2026-11-11T18:10:00Z",
			},
			{
				from: "noorhaddad",
				text: "Send it over. Not on a Friday afternoon though 😄",
				at: "2026-11-11T18:24:00Z",
			},
		],
	},
	{
		with: "tnovak",
		messages: [
			{
				from: "noorhaddad",
				text: "Which carriage did you pick for the Amsterdam sleeper?",
				at: "2026-11-10T09:00:00Z",
			},
			{
				from: "tnovak",
				text: "The four-berth couchette with the lock. Book early, they go fast in December.",
				at: "2026-11-10T09:30:00Z",
			},
		],
	},
	{
		with: "hanasato",
		messages: [
			{
				from: "hanasato",
				text: "Thank you for the follow! The otter says hi.",
				at: "2026-11-08T11:00:00Z",
			},
		],
	},
];
