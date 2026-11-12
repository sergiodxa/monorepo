/**
 * Tern's fixture data: the models, projects and saved conversations of Ines Okafor, an
 * invented designer, and the canned replies a new message is answered with, picked by the
 * words it uses. Every screen reads from here, so the sidebar, palette and pages agree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoAppActionHref, demoAppFrameHref, demoAppHref } from "~/resources/views/demo-apps";

/** Tern's addresses, keyed by page path under the app. */
export const href = demoAppHref("tern");

/** Where Tern's forms post, keyed by the page path the form acts on. */
export const actionHref = demoAppActionHref("tern");

/** Tern's frame addresses. */
export const frameHref = demoAppFrameHref("tern");

/** The moment every screen renders against, so "Today" never drifts. */
export const NOW = "2026-11-11T15:00:00Z";

/** The signed-in person. */
export const PERSON = { name: "Ines Okafor", email: "ines@harbor.studio", initials: "IO" };

/** One block of a rendered reply. Inline text reads `**bold**` and `` `code` ``. */
export type Block =
	| { type: "p"; text: string }
	| { type: "h"; text: string }
	| { type: "ul" | "ol"; items: string[] }
	| { type: "code"; language: string; code: string; title?: string }
	| { type: "table"; head: string[]; rows: string[][]; numeric?: number[] }
	| { type: "quote"; paragraphs: string[] };

/** The models a reply can come from, fastest first. */
export const MODELS = [
	{ id: "glide", name: "Tern Glide", description: "Quick answers for everyday questions" },
	{ id: "soar", name: "Tern Soar", description: "Balanced for writing and code" },
	{ id: "dive", name: "Tern Dive", description: "Takes longer on hard problems" },
] as const;

/** One model's id. */
export type ModelId = (typeof MODELS)[number]["id"];

/** The model a new chat starts on. */
export const DEFAULT_MODEL: ModelId = "soar";

/**
 * Finds a model by id, falling back to the default for anything else, so an address can
 * never name a model Tern lacks.
 */
export function findModel(id: string | null | undefined): (typeof MODELS)[number] {
	return MODELS.find((model) => model.id === id) ?? MODELS[1];
}

/** A file attached to a message, as its card shows it. */
export interface FileRef {
	name: string;
	/** Size and kind, such as "48 KB · Word document". */
	detail: string;
}

/** What a person wrote. */
export interface UserTurn {
	role: "user";
	text: string;
	files?: FileRef[];
}

/** What Tern answered. */
export interface AssistantTurn {
	role: "assistant";
	blocks: Block[];
	model: ModelId;
	rating?: "up" | "down";
	/** Whether the reply produced the conversation's canvas document. */
	canvas?: boolean;
}

/** One turn of a conversation. */
export type Turn = UserTurn | AssistantTurn;

/** A document a conversation produced, which the canvas pane shows beside it. */
export interface Canvas {
	title: string;
	kind: "code" | "document";
	/** Source for a code canvas, paragraphs for a document. */
	language?: string;
	content: string;
	version: number;
}

/** A project: a folder of chats sharing instructions and files. */
export interface Project {
	slug: string;
	name: string;
	description: string;
	instructions: string;
	files: Array<FileRef & { added: string }>;
}

/** A saved conversation. */
export interface Conversation {
	id: string;
	title: string;
	updatedAt: string;
	pinned?: boolean;
	project?: string;
	turns: Turn[];
	canvas?: Canvas;
}

/** Ines's projects. */
export const PROJECTS: Project[] = [
	{
		slug: "harbor-site",
		name: "Harbor site relaunch",
		description: "The studio's new website, launching in December.",
		instructions:
			"We are Harbor, a four-person design studio. Write in plain British English, short sentences, no exclamation marks. Code is TypeScript.",
		files: [
			{ name: "brand-voice.pdf", detail: "212 KB · PDF", added: "2026-10-28T10:00:00Z" },
			{ name: "sitemap-v3.png", detail: "1.4 MB · Image", added: "2026-11-02T09:30:00Z" },
			{ name: "launch-plan.xlsx", detail: "38 KB · Spreadsheet", added: "2026-11-06T16:10:00Z" },
			{ name: "case-studies.docx", detail: "96 KB · Word document", added: "2026-11-09T11:45:00Z" },
		],
	},
	{
		slug: "thesis",
		name: "Thesis: urban heat",
		description: "MA thesis on street trees and summer heat in Lisbon.",
		instructions:
			"I am writing an MA thesis in urban design. Cite sources by author and year, and say when a claim needs one.",
		files: [
			{
				name: "chapter-2-draft.docx",
				detail: "164 KB · Word document",
				added: "2026-10-20T14:00:00Z",
			},
			{
				name: "lisbon-surface-temps.csv",
				detail: "2.1 MB · Spreadsheet",
				added: "2026-10-24T08:20:00Z",
			},
		],
	},
];

/**
 * Finds a project by slug.
 *
 * @param slug The path segment after `projects/`.
 * @returns The project, or `undefined` when none has that slug.
 */
export function findProject(slug: string): Project | undefined {
	return PROJECTS.find((project) => project.slug === slug);
}

/** The debounced search hook the coding conversation ends with, also its canvas. */
const SEARCH_HOOK = `import { useEffect, useRef, useState } from "react";

export function useDebouncedSearch<T>(
	query: string,
	search: (query: string, signal: AbortSignal) => Promise<T>,
	delay = 250,
) {
	let [result, setResult] = useState<T | null>(null);
	let [pending, setPending] = useState(false);
	let controller = useRef<AbortController | null>(null);

	useEffect(() => {
		if (query.trim() === "") return setResult(null);
		let timer = setTimeout(async () => {
			controller.current?.abort();
			controller.current = new AbortController();
			setPending(true);
			try {
				setResult(await search(query, controller.current.signal));
			} catch (error) {
				if ((error as Error).name !== "AbortError") throw error;
			} finally {
				setPending(false);
			}
		}, delay);
		return () => clearTimeout(timer);
	}, [query, search, delay]);

	return { result, pending };
}`;

/** Ines's conversations, newest first. */
export const CONVERSATIONS: Conversation[] = [
	{
		id: "debounce-search",
		title: "Debounce a search input",
		updatedAt: "2026-11-11T13:40:00Z",
		project: "harbor-site",
		turns: [
			{
				role: "user",
				text: "Our case-study search fires a request on every keystroke. How do I debounce it in TypeScript?",
			},
			{
				role: "assistant",
				model: "soar",
				blocks: [
					{
						type: "p",
						text: "Wait until the person stops typing for a moment, then search once. A small `debounce` helper does that for any function:",
					},
					{
						type: "code",
						language: "ts",
						title: "debounce.ts",
						code: `export function debounce<Args extends unknown[]>(
	run: (...args: Args) => void,
	delay = 250,
) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	return (...args: Args) => {
		clearTimeout(timer);
		timer = setTimeout(() => run(...args), delay);
	};
}`,
					},
					{ type: "p", text: "Wire it to the input once, not on every render:" },
					{
						type: "code",
						language: "ts",
						code: `let search = debounce((query: string) => loadCaseStudies(query), 250);
input.addEventListener("input", () => search(input.value));`,
					},
					{
						type: "ul",
						items: [
							"**250 ms** feels instant to most people; go to 400 ms on slow APIs.",
							"Trim the query first, so a stray space never searches.",
							"Debouncing cuts requests, but an early slow reply can still land after a later fast one.",
						],
					},
				],
			},
			{
				role: "user",
				text: "That last point bit us. Can it cancel the request that is still in flight?",
			},
			{
				role: "assistant",
				model: "soar",
				canvas: true,
				blocks: [
					{ type: "h", text: "Cancel the stale request" },
					{
						type: "p",
						text: "Give each search an `AbortController` and abort the previous one before starting the next. `fetch` rejects with an `AbortError`, which you can ignore.",
					},
					{
						type: "p",
						text: "Since the case-study page is React, here it is as a hook. I put it in the canvas so you can keep editing it:",
					},
					{
						type: "ol",
						items: [
							"The timer waits for typing to pause.",
							"Before searching, the hook aborts the previous request.",
							"An `AbortError` is swallowed; anything else still throws.",
						],
					},
					{
						type: "table",
						head: ["Approach", "Requests for “harbor”", "Stale results"],
						rows: [
							["No debounce", "6", "Possible"],
							["Debounce only", "1–2", "Possible"],
							["Debounce + abort", "1–2", "Never"],
						],
						numeric: [1],
					},
				],
			},
		],
		canvas: {
			title: "useDebouncedSearch.ts",
			kind: "code",
			language: "ts",
			content: SEARCH_HOOK,
			version: 2,
		},
	},
	{
		id: "launch-email",
		title: "Rewrite the launch email",
		updatedAt: "2026-11-11T10:05:00Z",
		pinned: true,
		project: "harbor-site",
		turns: [
			{
				role: "user",
				text: "Can you make this launch email clearer and shorter? It goes to about 900 past clients.",
				files: [{ name: "launch-email-draft.docx", detail: "48 KB · Word document" }],
			},
			{
				role: "assistant",
				model: "soar",
				canvas: true,
				blocks: [
					{
						type: "p",
						text: "Your draft spends three paragraphs on the studio’s history before it says what is new. Here is a version that leads with the news:",
					},
					{
						type: "quote",
						paragraphs: [
							"**Subject:** Harbor has a new home online",
							"Hi {first name}, our new site is live. It shows the work we are proudest of, with the numbers behind each project.",
							"If we have worked together, you will find your project among the case studies. Tell us if anything needs correcting.",
							"— Ines, for everyone at Harbor",
						],
					},
					{ type: "h", text: "What changed" },
					{
						type: "ul",
						items: [
							"Cut from 312 words to 71.",
							"The news is in the first sentence, and the subject line says it too.",
							"One link, so the email has one job.",
							"Signed by a person rather than “The Harbor Team”.",
						],
					},
					{
						type: "p",
						text: "Want two more subject lines to A/B test? I would try “Your project is on our new site” for past clients.",
					},
				],
			},
		],
		canvas: {
			title: "Launch email",
			kind: "document",
			content:
				"Subject: Harbor has a new home online\n\nHi {first name},\n\nOur new site is live. It shows the work we are proudest of, with the numbers behind each project.\n\nIf we have worked together, you will find your project among the case studies. Tell us if anything needs correcting.\n\n— Ines, for everyone at Harbor",
			version: 3,
		},
	},
	{
		id: "lisbon-offsite",
		title: "Plan a 3-day Lisbon offsite",
		updatedAt: "2026-11-10T18:20:00Z",
		pinned: true,
		turns: [
			{
				role: "user",
				text: "Plan a three-day offsite in Lisbon for four people in March. Mix work sessions with time outside. Availability attached.",
				files: [{ name: "team-availability.csv", detail: "2 KB · Spreadsheet" }],
			},
			{
				role: "assistant",
				model: "dive",
				blocks: [
					{
						type: "p",
						text: "Everyone is free **11–13 March**, a Wednesday to Friday. Mornings are for work while energy is high; afternoons get you outside.",
					},
					{
						type: "table",
						head: ["Day", "Morning", "Afternoon", "Evening"],
						rows: [
							[
								"Wed 11",
								"Arrive, set goals for the year",
								"Walk Alfama to the Miradouro",
								"Dinner in Mouraria",
							],
							["Thu 12", "Site relaunch workshop", "Tram 28, then the tile museum", "Free evening"],
							["Fri 13", "Decide and assign next steps", "LX Factory and lunch", "Fly home"],
						],
					},
					{ type: "h", text: "Budget for four" },
					{
						type: "table",
						head: ["Item", "Per person", "Total"],
						rows: [
							["Flights", "€180", "€720"],
							["Apartment, 2 nights", "€140", "€560"],
							["Meeting room, 2 mornings", "€45", "€180"],
							["Food and transport", "€120", "€480"],
						],
						numeric: [1, 2],
					},
					{
						type: "p",
						text: "That comes to **€1,940**. Book the apartment first; March fills up around the Lisbon half marathon.",
					},
				],
			},
		],
	},
	{
		id: "postgres-or-sqlite",
		title: "Postgres or SQLite for a side project",
		updatedAt: "2026-11-08T21:10:00Z",
		turns: [
			{ role: "user", text: "Postgres or SQLite for a small booking app with maybe 200 users?" },
			{
				role: "assistant",
				model: "glide",
				blocks: [
					{
						type: "p",
						text: "SQLite, unless you already run Postgres somewhere. At 200 users the database is the least of your worries.",
					},
					{
						type: "table",
						head: ["", "SQLite", "Postgres"],
						rows: [
							["Setup", "A file", "A server to run"],
							["Concurrent writes", "One at a time", "Many"],
							["Backups", "Copy the file", "pg_dump or managed"],
							["Moving later", "Possible", "—"],
						],
					},
				],
			},
		],
	},
	{
		id: "container-queries",
		title: "Explain CSS container queries",
		updatedAt: "2026-11-06T09:30:00Z",
		project: "harbor-site",
		turns: [
			{ role: "user", text: "Explain container queries like I already know media queries." },
			{
				role: "assistant",
				model: "soar",
				blocks: [
					{
						type: "p",
						text: "A media query asks how wide the **window** is. A container query asks how wide the **box the component sits in** is, so a card can switch layout in a sidebar and in a full-width grid without knowing which it is in.",
					},
					{
						type: "code",
						language: "css",
						code: `.card-list { container-type: inline-size; }

@container (width > 32rem) {
	.card { grid-template-columns: 8rem 1fr; }
}`,
					},
				],
			},
		],
	},
	{
		id: "street-trees",
		title: "Outline chapter 3 on street trees",
		updatedAt: "2026-11-04T16:45:00Z",
		project: "thesis",
		turns: [
			{
				role: "user",
				text: "Help me outline chapter 3: how street trees change summer temperatures.",
			},
			{
				role: "assistant",
				model: "dive",
				blocks: [
					{
						type: "ol",
						items: [
							"**Mechanisms**: shade and evapotranspiration, and why they differ at noon and at night.",
							"**Evidence from other cities**: compare two or three studies; this needs sources.",
							"**Lisbon’s data**: your surface temperature file, street by street.",
							"**What it means for planting**: species, spacing and the cost of watering.",
						],
					},
					{ type: "p", text: "Section 2 carries the argument, so give it the most room." },
				],
			},
		],
	},
	{
		id: "flaky-test",
		title: "Fix a flaky date test",
		updatedAt: "2026-10-30T11:00:00Z",
		turns: [
			{ role: "user", text: "A test that checks “3 days ago” fails every Monday on CI. Why?" },
			{
				role: "assistant",
				model: "glide",
				blocks: [
					{
						type: "p",
						text: "The test reads the real clock, and CI runs in UTC while your fixture was written in local time. Pin the clock instead of reading it:",
					},
					{
						type: "code",
						language: "ts",
						code: `vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));`,
					},
				],
			},
		],
	},
	{
		id: "studio-names",
		title: "Name ideas for a ceramics studio",
		updatedAt: "2026-10-12T19:30:00Z",
		turns: [
			{
				role: "user",
				text: "My sister is opening a ceramics studio by the sea. Short name ideas?",
			},
			{
				role: "assistant",
				model: "glide",
				blocks: [
					{ type: "ul", items: ["Tidewheel", "Salt & Slip", "Low Tide Clay", "Kiln on the Quay"] },
					{
						type: "p",
						text: "Check the domain and the Instagram handle before she falls for one.",
					},
				],
			},
		],
	},
];

/**
 * Finds a conversation by id.
 *
 * @param id The path segment after `c/`.
 * @returns The conversation, or `undefined` when none has that id.
 */
export function findConversation(id: string): Conversation | undefined {
	return CONVERSATIONS.find((conversation) => conversation.id === id);
}

/** How the sidebar groups history, by age against {@link NOW}. */
export interface HistoryGroup {
	label: string;
	conversations: Conversation[];
}

/** The day a timestamp falls on, counted in whole days. */
function dayNumber(at: string): number {
	return Math.floor(Date.parse(at) / 86_400_000);
}

/** Which history group a conversation `age` days old belongs to, as an index into the groups. */
function ageGroup(age: number): number {
	if (age <= 0) return 0;
	if (age === 1) return 1;
	if (age <= 7) return 2;
	if (age <= 30) return 3;
	return 4;
}

/**
 * Groups unpinned conversations by age: Today, Yesterday, Previous 7 days, Previous 30 days,
 * then Older. Empty groups are left out, and each keeps newest first.
 *
 * @param conversations The conversations to group.
 * @returns The non-empty groups, newest first.
 */
export function historyGroups(conversations: Conversation[]): HistoryGroup[] {
	let today = dayNumber(NOW);
	let groups: HistoryGroup[] = [
		{ label: "Today", conversations: [] },
		{ label: "Yesterday", conversations: [] },
		{ label: "Previous 7 days", conversations: [] },
		{ label: "Previous 30 days", conversations: [] },
		{ label: "Older", conversations: [] },
	];
	for (let conversation of conversations) {
		let age = today - dayNumber(conversation.updatedAt);
		groups[ageGroup(age)]!.conversations.push(conversation);
	}
	return groups.filter((group) => group.conversations.length > 0);
}

/**
 * The plain text of a turn, for search and for the snippet under a result.
 *
 * @param turn The turn.
 * @returns Its words, with Markdown marks removed.
 */
export function turnText(turn: Turn): string {
	if (turn.role === "user") return turn.text;
	return turn.blocks
		.flatMap((block) => {
			switch (block.type) {
				case "p":
				case "h":
					return [block.text];
				case "ul":
				case "ol":
					return block.items;
				case "quote":
					return block.paragraphs;
				case "code":
					return [block.code];
				case "table":
					return [...block.head, ...block.rows.flat()];
			}
		})
		.join(" ")
		.replaceAll(/\*\*|`/g, "");
}

/** One search result: the conversation and the line that matched. */
export interface SearchResult {
	conversation: Conversation;
	snippet: string;
}

/**
 * Finds conversations whose title or text holds every word of the query, newest first.
 *
 * @param query What the person typed; blank finds nothing.
 * @returns The matches with a snippet around the first word.
 */
export function searchConversations(query: string): SearchResult[] {
	let words = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return [];
	return CONVERSATIONS.flatMap((conversation) => {
		let body = conversation.turns.map(turnText).join(" ");
		let haystack = `${conversation.title} ${body}`.toLowerCase();
		if (!words.every((word) => haystack.includes(word))) return [];
		let at = Math.max(0, body.toLowerCase().indexOf(words[0]!));
		let start = Math.max(0, at - 40);
		let snippet = `${start > 0 ? "…" : ""}${body.slice(start, start + 120).trim()}…`;
		return [{ conversation, snippet }];
	});
}

/** Which canned reply a new message gets. */
export type ReplyTopic = "code" | "writing" | "plan" | "general";

/** Words that pick each topic, checked in this order; anything else is general. */
const TOPIC_WORDS: Array<[ReplyTopic, RegExp]> = [
	[
		"code",
		/\b(code|function|bug|error|typescript|javascript|regex|sql|css|test|api|react|python|script)\b/i,
	],
	["writing", /\b(email|write|rewrite|draft|letter|tone|edit|essay|post|shorter|clearer)\b/i],
	["plan", /\b(plan|compare|schedule|trip|budget|table|vs|versus|itinerary|week|options)\b/i],
];

/**
 * Picks the canned reply for a message by the words it uses.
 *
 * @param prompt What the person sent.
 * @returns The topic whose words it uses first, else `"general"`.
 */
export function replyTopic(prompt: string): ReplyTopic {
	return TOPIC_WORDS.find(([, words]) => words.test(prompt))?.[0] ?? "general";
}

/** Two replies per topic: the first answer, and the one Regenerate offers. */
export const CANNED_REPLIES: Record<ReplyTopic, [Block[], Block[]]> = {
	code: [
		[
			{
				type: "p",
				text: "Here is a small, typed version you can drop in. It returns early on bad input, so the happy path reads top to bottom:",
			},
			{
				type: "code",
				language: "ts",
				code: `export function parseDuration(input: string): number | null {
	let match = /^(\\d+)\\s*(ms|s|m|h)$/.exec(input.trim());
	if (match === null) return null;
	let [, amount, unit] = match;
	let scale = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000 }[unit as "ms"];
	return Number(amount) * scale;
}`,
			},
			{
				type: "ul",
				items: [
					"`null` for anything it cannot read, so callers decide what an error means.",
					'Add a test for `" 5 s "` with spaces; that is the case people forget.',
				],
			},
		],
		[
			{
				type: "p",
				text: "Another way: keep the units in a map and let a single regular expression do the work.",
			},
			{
				type: "code",
				language: "ts",
				code: `const UNITS = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000 } as const;

export function toMilliseconds(input: string) {
	let [, amount, unit] = input.trim().match(/^(\\d+)\\s*(ms|s|m|h)$/) ?? [];
	return unit ? Number(amount) * UNITS[unit as keyof typeof UNITS] : null;
}`,
			},
			{
				type: "p",
				text: "Shorter, but the first version is easier to step through in a debugger.",
			},
		],
	],
	writing: [
		[
			{ type: "p", text: "Here is a tighter version that leads with what the reader needs:" },
			{
				type: "quote",
				paragraphs: [
					"Thanks for waiting. Your order shipped this morning and should arrive by Friday.",
					"If anything is missing, reply to this email and we will sort it out the same day.",
				],
			},
			{ type: "h", text: "What I changed" },
			{
				type: "ul",
				items: [
					"Moved the news to the first sentence.",
					"Cut the apology to two words; one is enough.",
					"Ended on a single, clear next step.",
				],
			},
		],
		[
			{ type: "p", text: "A warmer take, if your readers know you personally:" },
			{
				type: "quote",
				paragraphs: [
					"Good news: your order is on its way and should be with you by Friday.",
					"Thank you for your patience. Write back any time if something is not right.",
				],
			},
			{
				type: "p",
				text: "It is a little longer, but it sounds like a person rather than a system.",
			},
		],
	],
	plan: [
		[
			{ type: "p", text: "Here is a side-by-side so the trade-offs are easy to see:" },
			{
				type: "table",
				head: ["Option", "Cost", "Time", "Best for"],
				rows: [
					["Do it yourself", "€0", "2 weeks", "Learning the ropes"],
					["Hire a freelancer", "€1,200", "5 days", "A fixed scope"],
					["Use an agency", "€4,500", "3 days", "Launch deadlines"],
				],
				numeric: [1],
			},
			{
				type: "p",
				text: "With a budget under €2,000 and no hard deadline, the **freelancer** is the sensible middle.",
			},
		],
		[
			{ type: "p", text: "Broken into weeks instead:" },
			{
				type: "table",
				head: ["Week", "Focus", "Done when"],
				rows: [
					["1", "Agree scope and budget", "A one-page brief is signed off"],
					["2", "Build the first version", "It works end to end"],
					["3", "Test with five people", "The worst three problems are fixed"],
				],
			},
		],
	],
	general: [
		[
			{
				type: "p",
				text: "Good question. The short answer: start small, and decide with real numbers.",
			},
			{ type: "h", text: "A simple way in" },
			{
				type: "ol",
				items: [
					"Write down what “done” looks like in one sentence.",
					"List the three things most likely to go wrong.",
					"Try the cheapest version first and see what you learn.",
				],
			},
			{
				type: "p",
				text: "Tell me more about your situation and I can make this specific. I am a demo, so my answers are canned.",
			},
		],
		[
			{
				type: "p",
				text: "Here is another angle: work backwards from the outcome you want, and make the first step something you can do today.",
			},
			{
				type: "ul",
				items: [
					"**Today:** write the one-sentence goal.",
					"**This week:** ask one person who has done it before.",
					"**This month:** ship a rough first version.",
				],
			},
		],
	],
};

/**
 * A short title for a new chat, from the start of its first message.
 *
 * @param prompt The first message.
 * @returns Its first six words, with an ellipsis when cut.
 */
export function titleFrom(prompt: string): string {
	let words = prompt.trim().split(/\s+/);
	let title = words.slice(0, 6).join(" ");
	return words.length > 6 ? `${title}…` : title || "New chat";
}
