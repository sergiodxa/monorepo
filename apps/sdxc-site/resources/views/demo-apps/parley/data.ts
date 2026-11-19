/**
 * Parley's invented workspace: Fernhill, an eight-person studio shipping version 3 of its
 * garden-planning app, Sprout. Its people, channels, direct messages, history, pinned files and
 * the lines teammates write live while a visitor watches. Times are minutes before now.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoAppActionHref, demoAppHref, demoAppStreamHref } from "~/resources/views/demo-apps";

/** The folder name every Parley address is built from. */
export const SLUG = "parley";

/** A page path under Parley to its address. */
export const href = demoAppHref(SLUG);

/** A page path under Parley to the address its forms post to. */
export const actionHref = demoAppActionHref(SLUG);

/** A live part's path to its stream's address. */
export const streamHref = demoAppStreamHref(SLUG);

/** Where a person is right now, drawn as the dot on their avatar. */
export type Presence = "active" | "away" | "dnd";

/** A teammate, or the visitor, who is `sam`. */
export interface Person {
	handle: string;
	name: string;
	/** What they do at the studio, shown in member lists and mention suggestions. */
	title: string;
	initials: string;
	/** The hue of their avatar tile, so faces tell apart at a glance. */
	hue: number;
	presence: Presence;
	/** A status line, such as "In crits until 3". */
	status?: string;
	/** Marks an integration, which posts with an "App" chip and never types. */
	bot?: boolean;
	/** Their local time zone, shown in their profile card. */
	zone: string;
}

/** The person the visitor signs in as. */
export const ME_HANDLE = "sam";

/** Everyone in the workspace, the visitor first. */
export const PEOPLE: readonly Person[] = [
	{
		handle: "sam",
		name: "Sam Rivera",
		title: "Product engineer",
		initials: "SR",
		hue: 355,
		presence: "active",
		zone: "Lisbon",
	},
	{
		handle: "mira",
		name: "Mira Okafor",
		title: "Design lead",
		initials: "MO",
		hue: 28,
		presence: "active",
		status: "In crits until 3",
		zone: "Lisbon",
	},
	{
		handle: "theo",
		name: "Theo Lindqvist",
		title: "Backend engineer",
		initials: "TL",
		hue: 220,
		presence: "active",
		zone: "Stockholm",
	},
	{
		handle: "priya",
		name: "Priya Raman",
		title: "Product manager",
		initials: "PR",
		hue: 290,
		presence: "active",
		status: "Launch week",
		zone: "London",
	},
	{
		handle: "jonah",
		name: "Jonah Weiss",
		title: "Frontend engineer",
		initials: "JW",
		hue: 150,
		presence: "away",
		zone: "Berlin",
	},
	{
		handle: "lucia",
		name: "Lucía Ferrer",
		title: "Research & content",
		initials: "LF",
		hue: 55,
		presence: "active",
		zone: "Madrid",
	},
	{
		handle: "kenji",
		name: "Kenji Mori",
		title: "iOS engineer",
		initials: "KM",
		hue: 190,
		presence: "dnd",
		status: "Heads down on the widget",
		zone: "Lisbon",
	},
	{
		handle: "bea",
		name: "Bea Adeyemi",
		title: "Operations",
		initials: "BA",
		hue: 120,
		presence: "away",
		zone: "Lagos",
	},
	{
		handle: "oskar",
		name: "Oskar Nyberg",
		title: "QA",
		initials: "ON",
		hue: 250,
		presence: "active",
		zone: "Stockholm",
	},
	{
		handle: "fernbot",
		name: "Fernbot",
		title: "Deploys and alerts",
		initials: "FB",
		hue: 160,
		presence: "active",
		bot: true,
		zone: "UTC",
	},
];

/**
 * Finds a person by handle.
 *
 * @returns The person, or `undefined` for a handle nobody has.
 */
export function findPerson(handle: string): Person | undefined {
	return PEOPLE.find((person) => person.handle === handle);
}

/** The visitor. */
export const ME: Person = findPerson(ME_HANDLE)!;

/** One file attached to a message. */
export interface FileRef {
	name: string;
	/** Size in bytes. */
	size: number;
	/** `image` draws a preview tile; anything else a file card. */
	kind: "image" | "pdf" | "doc" | "sheet" | "code" | "other";
}

/** A reply in a thread. */
export interface Reply {
	id: string;
	author: string;
	/** Minutes before now. */
	ago: number;
	text: string;
	reactions?: Record<string, readonly string[]>;
}

/** One message in a channel or a direct conversation. */
export interface Message {
	id: string;
	author: string;
	/** Minutes before now. */
	ago: number;
	/** Markdown: bold, italics, code, fences, links, lists, quotes and `@handle` mentions. */
	text: string;
	files?: readonly FileRef[];
	/** Who reacted with each emoji, by handle. */
	reactions?: Record<string, readonly string[]>;
	replies?: readonly Reply[];
	pinned?: boolean;
	edited?: boolean;
}

/** A conversation's kind: a named channel or a direct message with one person. */
export type ConversationKind = "channel" | "dm";

/** A channel or a direct conversation. */
export interface Conversation {
	/** `c:<name>` for a channel, `d:<handle>` for a DM; also its cookie key. */
	key: string;
	kind: ConversationKind;
	/** The channel's name, or the other person's handle. */
	name: string;
	topic: string;
	/** What the channel is for, in the details panel. */
	purpose?: string;
	/** Handles of everyone in it. */
	members: readonly string[];
	/** Whether it is private, drawn with a lock. */
	private?: boolean;
	/** Who made it and how many days ago. */
	created?: { by: string; daysAgo: number };
	/**
	 * Minutes before now the visitor last read it: later messages from others are unread, and
	 * the "New" divider sits before the first of them.
	 */
	readAgo: number;
	messages: readonly Message[];
}

/** Minutes in a day, for history a few days back. */
const DAY = 24 * 60;

/** Everyone but the bot, the default membership of a studio-wide channel. */
const STUDIO = PEOPLE.filter((person) => !person.bot).map((person) => person.handle);

/** Every channel and direct conversation, in the order the sidebar lists them. */
export const CONVERSATIONS: readonly Conversation[] = [
	{
		key: "c:general",
		kind: "channel",
		name: "general",
		topic: "Studio-wide news. Threads for anything longer than a paragraph.",
		purpose: "Announcements and anything the whole studio should see.",
		members: STUDIO,
		created: { by: "bea", daysAgo: 1460 },
		readAgo: 30,
		messages: [
			{
				id: "g1",
				author: "bea",
				ago: 2 * DAY + 300,
				text: "Office heating is fixed :tada: Thanks for bearing with the blankets. Invoices for November go out **Friday**, so log your hours by Thursday evening.",
				reactions: { "🎉": ["mira", "theo", "kenji", "lucia"], "🙏": ["sam", "priya"] },
			},
			{
				id: "g2",
				author: "priya",
				ago: DAY + 180,
				text: "Reminder: Sprout 3.0 launch is **Wednesday, Dec 2**. The checklist is pinned in #launch-v3. If something on it is yours and you can't make the date, tell me today rather than Tuesday 🙂",
				pinned: true,
				reactions: { "👍": ["sam", "theo", "jonah", "oskar"] },
				replies: [
					{
						id: "g2-r1",
						author: "kenji",
						ago: DAY + 150,
						text: "Widget is on track. The App Store review is the wildcard, submitting tomorrow.",
					},
					{
						id: "g2-r2",
						author: "priya",
						ago: DAY + 140,
						text: "Perfect, thanks Kenji.",
					},
				],
			},
			{
				id: "g3",
				author: "lucia",
				ago: 260,
				text: "Six interviews done for the planting-calendar study. Short version: people plan by **weekend**, not by date. Full notes → https://notes.fernhill.studio/research/planting-calendar",
				reactions: {
					"🔥": ["mira", "priya"],
					"👀": ["jonah"],
					":sprout:": ["priya", "mira", "sam"],
				},
			},
			{
				id: "g4",
				author: "mira",
				ago: 120,
				text: "Studio lunch on Friday is at the Portuguese place on the corner :fernhill: Reply in thread if you have a dietary thing I should pass on :salad:",
				replies: [
					{ id: "g4-r1", author: "theo", ago: 110, text: "Vegetarian, as ever :seedling:" },
					{ id: "g4-r2", author: "oskar", ago: 95, text: "No shellfish for me please" },
					{ id: "g4-r3", author: "lucia", ago: 40, text: "I'll bring dessert!" },
				],
			},
			{
				id: "g5",
				author: "theo",
				ago: 35,
				text: "Heads up: staging will be down 14:00–14:20 while I rotate the database credentials.",
				reactions: { "👍": ["jonah", "kenji"] },
			},
		],
	},
	{
		key: "c:launch-v3",
		kind: "channel",
		name: "launch-v3",
		topic: "Sprout 3.0 ships Dec 2. Checklist pinned. Blockers get a 🚨.",
		purpose:
			"Everything about getting Sprout 3.0 out the door: checklist, blockers, copy and store assets.",
		members: ["sam", "mira", "theo", "priya", "jonah", "kenji", "lucia", "oskar"],
		created: { by: "priya", daysAgo: 41 },
		readAgo: 95,
		messages: [
			{
				id: "l1",
				author: "priya",
				ago: DAY + 400,
				text: "**Launch checklist** (pin this)\n\n- [x] Release notes draft\n- [x] Store screenshots\n- [ ] Widget through App Store review\n- [ ] Onboarding copy final\n- [ ] Rollout flag at 10% → 50% → 100%",
				pinned: true,
				reactions: { "📌": ["mira", "sam"] },
			},
			{
				id: "l2",
				author: "mira",
				ago: DAY + 120,
				text: "Store screenshots, final. Light and dark.",
				files: [
					{ name: "store-screenshots-light.png", size: 2_310_000, kind: "image" },
					{ name: "store-screenshots-dark.png", size: 2_190_000, kind: "image" },
				],
				reactions: { "😍": ["priya", "lucia", "kenji"], "🎉": ["sam"] },
			},
			{
				id: "l3",
				author: "oskar",
				ago: 300,
				text: "Regression pass on 3.0 RC2 is done. Two things left, both small:\n\n1. Frost dates show in °F for UK accounts\n2. The seed packet scanner crashes on the iPad mini when the torch is on",
				replies: [
					{
						id: "l3-r1",
						author: "theo",
						ago: 280,
						text: "The °F one is mine — we read the locale before the account loads. Fix is up, @sam can you review?",
					},
					{
						id: "l3-r2",
						author: "kenji",
						ago: 250,
						text: "Torch crash is an AVFoundation thing, I have a workaround. Not a blocker.",
					},
				],
			},
			{
				id: "l4",
				author: "theo",
				ago: 80,
				text: "@sam the units fix is in review. It's three lines; the bug was reading the locale before the account loaded:\n\n```ts\nlet units = account?.units ?? unitsFor(locale);\nreturn formatTemperature(frostDate.celsius, units);\n```",
				reactions: { "👀": ["sam"] },
			},
			{
				id: "l5",
				author: "lucia",
				ago: 60,
				text: "Onboarding copy v4 is up for a last read. I cut the third screen entirely — it repeated the second. Comments welcome until tonight.",
				files: [{ name: "onboarding-copy-v4.pdf", size: 184_000, kind: "pdf" }],
			},
			{
				id: "l6",
				author: "priya",
				ago: 25,
				text: "@sam can you own the rollout flag on the day? You'd flip it at 10:00 and watch the dashboards with @theo 🙏",
			},
			{
				id: "l7",
				author: "jonah",
				ago: 12,
				text: "Release notes page is live behind the flag: https://sprout.example.com/whats-new. The animation on the hero is ~40 KB, happy with that.",
				reactions: { "🚀": ["priya", "mira"], ":shipit:": ["theo", "kenji", "oskar"] },
			},
		],
	},
	{
		key: "c:design",
		kind: "channel",
		name: "design",
		topic: "Crits, files and work in progress. Post early, post often.",
		purpose: "Design work at every stage, from sketches to specs.",
		members: ["sam", "mira", "priya", "jonah", "lucia", "kenji"],
		created: { by: "mira", daysAgo: 900 },
		readAgo: 400,
		messages: [
			{
				id: "d1",
				author: "mira",
				ago: 2 * DAY + 90,
				text: "New empty states for the garden list. I went with illustrations that hint at what goes there rather than a generic plant.",
				files: [{ name: "empty-states.png", size: 1_420_000, kind: "image" }],
				reactions: { "💚": ["lucia", "priya", "jonah"] },
			},
			{
				id: "d2",
				author: "jonah",
				ago: 2 * DAY + 60,
				text: "Love these. Can I get them as SVG? I'd like to tint them with the theme colour in dark mode.",
			},
			{
				id: "d3",
				author: "mira",
				ago: 2 * DAY + 55,
				text: "Yes — exporting with `currentColor` fills now.",
			},
			{
				id: "d4",
				author: "kenji",
				ago: 300,
				text: "Widget sizes for 3.0. Small shows the next task, medium adds the frost forecast.",
				files: [{ name: "widget-sizes.png", size: 860_000, kind: "image" }],
				replies: [
					{
						id: "d4-r1",
						author: "mira",
						ago: 290,
						text: "Medium is lovely. Small feels a bit crowded with the date — drop it?",
					},
					{ id: "d4-r2", author: "kenji", ago: 280, text: "Agreed, dropping it. :sprout:" },
				],
			},
			{
				id: "d5",
				author: "priya",
				ago: 45,
				text: "Crit at 15:00 today: the planting calendar. @mira will walk us through three directions.",
			},
		],
	},
	{
		key: "c:engineering",
		kind: "channel",
		name: "engineering",
		topic: "Build, review, ship. Deploy noise lives in #deploys.",
		purpose: "Technical discussion, reviews and architecture.",
		members: ["sam", "theo", "jonah", "kenji", "oskar"],
		created: { by: "theo", daysAgo: 1200 },
		readAgo: 15,
		messages: [
			{
				id: "e1",
				author: "jonah",
				ago: DAY + 600,
				text: "PSA: the garden grid now virtualizes rows. A 400-plant garden scrolls at 60fps on the old Android test phone :chart_with_upwards_trend:",
				reactions: { "🔥": ["sam", "theo", "kenji"], ":lgtm:": ["oskar"] },
			},
			{
				id: "e2",
				author: "sam",
				ago: DAY + 590,
				text: "That was the last thing I wanted before 3.0. Nice one.",
			},
			{
				id: "e3",
				author: "theo",
				ago: 400,
				text: 'Proposal: we move frost forecasts to a nightly job instead of fetching per request. Sketch:\n\n```ts\nschedule("0 3 * * *", async () => {\n\tfor await (let garden of gardens.active()) {\n\t\tawait forecasts.refresh(garden.location);\n\t}\n});\n```\n\nCuts weather API calls by ~90%.',
				replies: [
					{
						id: "e3-r1",
						author: "sam",
						ago: 380,
						text: "+1. We should batch by location though, lots of gardens share a postcode.",
					},
					{ id: "e3-r2", author: "theo", ago: 370, text: "Good call, will group by geohash." },
				],
			},
			{
				id: "e4",
				author: "oskar",
				ago: 20,
				text: "Flaky test of the week: `calendar › moves a task across a DST change`. Fails 1 in 30 on CI, never locally. I suspect the test's clock.",
			},
		],
	},
	{
		key: "c:deploys",
		kind: "channel",
		name: "deploys",
		topic: "Every deploy and rollback, posted by Fernbot.",
		members: ["sam", "theo", "jonah", "kenji", "oskar", "fernbot"],
		created: { by: "theo", daysAgo: 700 },
		readAgo: 90,
		messages: [
			{
				id: "x1",
				author: "fernbot",
				ago: 240,
				text: "✅ **api** deployed `a3f91c2` to production · 2m 41s · by @theo",
			},
			{
				id: "x2",
				author: "fernbot",
				ago: 70,
				text: "✅ **web** deployed `77d0e5b` to staging · 1m 12s · by @jonah",
			},
			{
				id: "x3",
				author: "fernbot",
				ago: 15,
				text: "⚠️ **api** canary error rate 1.4% (threshold 1%) · rolled back to `a3f91c2` automatically",
				reactions: { "👀": ["theo"] },
			},
		],
	},
	{
		key: "c:random",
		kind: "channel",
		name: "random",
		topic: "Lunch, links, plants and cats.",
		members: STUDIO,
		created: { by: "bea", daysAgo: 1460 },
		readAgo: 600,
		messages: [
			{
				id: "r1",
				author: "lucia",
				ago: 3 * DAY,
				text: "My tomato plant is producing in November. I don't know what to do with this information.",
				files: [{ name: "november-tomato.jpg", size: 980_000, kind: "image" }],
				reactions: { "🍅": ["mira", "theo", "bea", "sam", "jonah"] },
			},
			{
				id: "r2",
				author: "kenji",
				ago: 500,
				text: "Office cat update: Figo has claimed the new chair. It is his chair now.",
				reactions: { "🐈": ["mira", "lucia", "oskar"], "😂": ["priya"] },
			},
			{
				id: "r3",
				author: "jonah",
				ago: 50,
				text: "Anyone else going to the type design meetup on Thursday? https://example.com/events/type-night",
			},
		],
	},
	{
		key: "c:research",
		kind: "channel",
		name: "research",
		topic: "Interviews, studies and what we learned.",
		private: true,
		members: ["sam", "lucia", "priya", "mira"],
		created: { by: "lucia", daysAgo: 300 },
		readAgo: 200,
		messages: [
			{
				id: "s1",
				author: "lucia",
				ago: 3 * DAY + 200,
				text: "Recruiting for the planting-calendar study: 8 people who grow food at home, a mix of balcony and allotment.",
			},
			{
				id: "s2",
				author: "lucia",
				ago: 270,
				text: "Synthesis board is up. The strongest pattern: people think in **weekends**, and plan the next one on Sunday evening.",
				files: [{ name: "synthesis-board.pdf", size: 3_400_000, kind: "pdf" }],
				reactions: { "💡": ["priya", "mira"] },
			},
		],
	},
	{
		key: "d:mira",
		kind: "dm",
		name: "mira",
		topic: "",
		members: ["sam", "mira"],
		readAgo: 9,
		messages: [
			{
				id: "dm1",
				author: "mira",
				ago: DAY + 30,
				text: "Do you have 10 minutes tomorrow to look at the calendar transitions? I want an engineer's eye on what's feasible.",
			},
			{ id: "dm2", author: "sam", ago: DAY + 25, text: "Sure, after standup?" },
			{ id: "dm3", author: "mira", ago: DAY + 24, text: "Perfect 🙌" },
			{
				id: "dm4",
				author: "mira",
				ago: 8,
				text: "Here's the prototype from this morning. The swipe between weeks is the bit I'm unsure about.",
				files: [{ name: "calendar-prototype.mp4", size: 6_100_000, kind: "other" }],
			},
		],
	},
	{
		key: "d:theo",
		kind: "dm",
		name: "theo",
		topic: "",
		members: ["sam", "theo"],
		readAgo: 70,
		messages: [
			{
				id: "dt1",
				author: "theo",
				ago: 200,
				text: "Want to pair on the forecast job this afternoon?",
			},
			{ id: "dt2", author: "sam", ago: 190, text: "Yes! 15:30 works." },
			{
				id: "dt3",
				author: "theo",
				ago: 65,
				text: "The canary rollback was me, sorry — a missing index on `forecasts.location`. Fixed, redeploying.",
			},
		],
	},
	{
		key: "d:priya",
		kind: "dm",
		name: "priya",
		topic: "",
		members: ["sam", "priya"],
		readAgo: 2000,
		messages: [
			{
				id: "dp1",
				author: "priya",
				ago: DAY + 500,
				text: "Thanks for jumping on the sync bug yesterday. Customers noticed 💛",
			},
			{ id: "dp2", author: "sam", ago: DAY + 490, text: "Anytime!" },
		],
	},
	{
		key: "d:lucia",
		kind: "dm",
		name: "lucia",
		topic: "",
		members: ["sam", "lucia"],
		readAgo: 2000,
		messages: [
			{
				id: "dl1",
				author: "lucia",
				ago: 3 * DAY + 60,
				text: "Could you share the analytics query for weekend sessions? I want it for the study write-up.",
			},
			{
				id: "dl2",
				author: "sam",
				ago: 3 * DAY + 40,
				text: "Here you go:\n\n```sql\nselect extract(dow from started_at) as day, count(*)\nfrom sessions\ngroup by 1 order by 1;\n```",
			},
		],
	},
];

/**
 * Finds a conversation by its key. A direct message with any teammate exists, empty until the
 * visitor writes, so every mention and member row leads somewhere.
 *
 * @returns The conversation, or `undefined` for a key nothing has.
 */
export function findConversation(key: string): Conversation | undefined {
	let found = CONVERSATIONS.find((conversation) => conversation.key === key);
	if (found !== undefined || !key.startsWith("d:")) return found;
	let person = findPerson(key.slice(2));
	if (person === undefined || person.handle === ME_HANDLE || person.bot) return undefined;
	return {
		key,
		kind: "dm",
		name: person.handle,
		topic: "",
		members: [ME_HANDLE, person.handle],
		readAgo: 0,
		messages: [],
	};
}

/** The channels, in sidebar order. */
export const CHANNELS = CONVERSATIONS.filter((conversation) => conversation.kind === "channel");

/** The direct conversations, in sidebar order. */
export const DIRECT = CONVERSATIONS.filter((conversation) => conversation.kind === "dm");

/**
 * The page path of a conversation: `c/<name>` for a channel, `d/<handle>` for a DM.
 *
 * @param key A conversation key.
 */
export function conversationPage(key: string): string {
	return key.replace(":", "/");
}

/**
 * The name a conversation shows: `#name` for a channel, the person's name for a DM.
 *
 * @param conversation The conversation.
 */
export function conversationTitle(conversation: Conversation): string {
	if (conversation.kind === "channel") return `#${conversation.name}`;
	return findPerson(conversation.name)?.name ?? conversation.name;
}

/** One line a teammate writes live while the visitor has a conversation open. */
export interface LiveLine {
	author: string;
	text: string;
	/** How long they type before it posts, in milliseconds. */
	typing: number;
	/** How long after the previous line they start typing, in milliseconds. */
	pause: number;
	reactions?: Record<string, readonly string[]>;
}

/** What teammates write while a visitor watches each conversation, in order. */
export const LIVE: Record<string, readonly LiveLine[]> = {
	"c:general": [
		{
			author: "bea",
			text: "Friday lunch is booked for 13:00, table for nine 🍽️",
			typing: 2600,
			pause: 2500,
		},
		{
			author: "kenji",
			text: "Widget passed App Store review :white_check_mark: :shipit:",
			typing: 1800,
			pause: 9000,
			reactions: { "🎉": ["priya", "mira"] },
		},
	],
	"c:launch-v3": [
		{
			author: "theo",
			text: "Units fix is merged :lgtm: RC3 building now — Fernbot will post when it lands.",
			typing: 2400,
			pause: 2000,
		},
		{
			author: "priya",
			text: "Amazing. That leaves the widget review and the onboarding copy. @lucia anything blocking the copy?",
			typing: 3000,
			pause: 6000,
		},
		{
			author: "lucia",
			text: "Nope, just waiting on comments until 18:00, then it's final ✍️",
			typing: 2200,
			pause: 4000,
		},
	],
	"c:design": [
		{
			author: "mira",
			text: "Calendar directions for the 15:00 crit, in order of how much I like them 😅",
			typing: 2400,
			pause: 2500,
		},
		{
			author: "jonah",
			text: "Direction B with the week strip would be easy to build, for what it's worth.",
			typing: 2600,
			pause: 7000,
		},
	],
	"c:engineering": [
		{
			author: "theo",
			text: "@oskar the DST test pins `Date.now` but not the zone. Try `TZ=Europe/Lisbon` in the CI env.",
			typing: 2800,
			pause: 2500,
		},
		{
			author: "oskar",
			text: "That was it. 50 green runs in a row 🙌",
			typing: 1600,
			pause: 8000,
		},
	],
	"c:deploys": [
		{
			author: "fernbot",
			text: "✅ **api** deployed `c81e0aa` to production · 2m 55s · by @theo",
			typing: 0,
			pause: 5000,
		},
	],
	"c:random": [
		{
			author: "mira",
			text: "Figo is now asleep on the printer. Please print nothing.",
			typing: 2000,
			pause: 3000,
		},
	],
	"d:mira": [
		{
			author: "mira",
			text: "No rush, but if you get a sec, does the week swipe feel too slow at 300ms?",
			typing: 3000,
			pause: 3000,
		},
	],
	"d:theo": [
		{
			author: "theo",
			text: "Redeploy is green. Still on for 15:30?",
			typing: 2000,
			pause: 4000,
		},
	],
};

/**
 * How a teammate answers what the visitor posts in a conversation, picked by the words it
 * uses, so the demo's replies read as answers rather than noise.
 *
 * @param key The conversation the visitor posted in.
 * @param text What they wrote.
 * @returns The handle of who answers and what they say.
 */
export function answerTo(key: string, text: string): { author: string; text: string } {
	let conversation = findConversation(key);
	let lower = text.toLowerCase();
	let mentioned = PEOPLE.find(
		(person) => person.handle !== ME_HANDLE && !person.bot && lower.includes(`@${person.handle}`),
	);
	let fallback = conversation?.kind === "dm" ? conversation.name : "priya";
	let author =
		mentioned?.handle ??
		conversation?.members.find((handle) => handle !== ME_HANDLE && !findPerson(handle)?.bot) ??
		fallback;
	if (conversation?.kind === "dm") author = conversation.name;
	if (lower.includes("?"))
		return { author, text: "Good question — let me check and get back to you in a bit." };
	if (/\b(thanks|thank you|ty)\b/.test(lower)) return { author, text: "Anytime 🙌" };
	if (/\b(ship|deploy|release|launch)\b/.test(lower)) {
		return { author, text: "Love it. I'll keep an eye on the dashboards 📈" };
	}
	if (/\b(review|pr|fix)\b/.test(lower))
		return { author, text: "On it, I'll take a look after lunch 👀" };
	return { author, text: "Nice, thanks for the update 👍" };
}

/** The reactions a message's action bar offers in one press, a custom emoji among them. */
export const QUICK_REACTIONS = ["👍", "🎉", "👀", ":shipit:"] as const;
