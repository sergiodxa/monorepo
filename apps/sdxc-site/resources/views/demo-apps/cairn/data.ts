/**
 * Cairn's fixtures: Saltmarsh, an invented product studio, with two teams, six people, their
 * projects, cycles and issues, all fixed to one moment so every relative time, chart and
 * roadmap line reads the same on every visit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoAppActionHref, demoAppFrameHref, demoAppHref } from "~/resources/views/demo-apps";

/** The demo's slug, its folder name. */
export const SLUG = "cairn";

/** Builds an address under the app. */
export const href = demoAppHref(SLUG);

/** Builds the address a form under the app posts to. */
export const actionHref = demoAppActionHref(SLUG);

/**
 * The address an edit posts to: the page the visitor is on, with its query, so the address
 * after the post is the page it returns to. My issues posts under `my`, the home screen's
 * other address, since a post needs a page path.
 */
export function editHref(page: string): string {
	return href(page === "" || page.startsWith("?") ? `my${page}` : page);
}

/** Builds the address of one of the app's frames. */
export const frameHref = demoAppFrameHref(SLUG);

/** The moment every fixture is measured from. */
export const NOW = "2026-11-12T15:00:00Z";

/** Today, as the roadmap and the cycles read it. */
export const TODAY = NOW.slice(0, 10);

/** The locale every date and number is written in. */
export const LOCALE = "en";

/** The workflow's states, in the order a board lays them out. */
export const STATUSES = ["backlog", "todo", "started", "review", "done", "canceled"] as const;

/** One workflow state. */
export type StatusId = (typeof STATUSES)[number];

/** Each state's name. */
export const STATUS_NAMES: Record<StatusId, string> = {
	backlog: "Backlog",
	todo: "Todo",
	started: "In Progress",
	review: "In Review",
	done: "Done",
	canceled: "Canceled",
};

/** Priorities, from none through urgent to low, as their menu orders them. */
export const PRIORITIES = [0, 1, 2, 3, 4] as const;

/** One priority: 0 none, 1 urgent, 2 high, 3 medium, 4 low. */
export type PriorityId = (typeof PRIORITIES)[number];

/** Each priority's name. */
export const PRIORITY_NAMES: Record<PriorityId, string> = {
	0: "No priority",
	1: "Urgent",
	2: "High",
	3: "Medium",
	4: "Low",
};

/** Sorts urgent first and no priority last. */
export function priorityRank(priority: PriorityId): number {
	return priority === 0 ? 5 : priority;
}

/** Whether a state counts as finished work, closed for every list and chart. */
export function isClosed(status: StatusId): boolean {
	return status === "done" || status === "canceled";
}

/** Someone at Saltmarsh. `hue` tints their initials tile. */
export interface Person {
	id: string;
	name: string;
	initials: string;
	email: string;
	hue: number;
}

/** The signed-in person's id. */
export const ME = "ilse";

/** Everyone at Saltmarsh, the signed-in person first. */
export const PEOPLE: readonly Person[] = [
	{ id: "ilse", name: "Ilse Varga", initials: "IV", email: "ilse@saltmarsh.studio", hue: 150 },
	{ id: "tomasz", name: "Tomasz Wren", initials: "TW", email: "tomasz@saltmarsh.studio", hue: 30 },
	{
		id: "adaeze",
		name: "Adaeze Nwosu",
		initials: "AN",
		email: "adaeze@saltmarsh.studio",
		hue: 300,
	},
	{
		id: "rafael",
		name: "Rafael Ortiz",
		initials: "RO",
		email: "rafael@saltmarsh.studio",
		hue: 220,
	},
	{ id: "mei", name: "Mei Tanaka", initials: "MT", email: "mei@saltmarsh.studio", hue: 0 },
	{ id: "jonah", name: "Jonah Pike", initials: "JP", email: "jonah@saltmarsh.studio", hue: 80 },
];

/** Finds a person by id. */
export function findPerson(id: string | undefined): Person | undefined {
	return PEOPLE.find((person) => person.id === id);
}

/** A team, whose key prefixes its issues' ids. */
export interface Team {
	id: string;
	key: string;
	name: string;
}

/** Saltmarsh's teams. */
export const TEAMS: readonly Team[] = [
	{ id: "web", key: "WEB", name: "Web" },
	{ id: "plat", key: "PLT", name: "Platform" },
];

/** Finds a team by id. */
export function findTeam(id: string | undefined): Team | undefined {
	return TEAMS.find((team) => team.id === id);
}

/** A label, with the dot colour it is drawn with in either theme. */
export interface Label {
	id: string;
	name: string;
	color: string;
}

/** Every label an issue can carry. */
export const LABELS: readonly Label[] = [
	{ id: "bug", name: "Bug", color: "oklch(0.63 0.19 25)" },
	{ id: "feature", name: "Feature", color: "oklch(0.62 0.13 150)" },
	{ id: "improvement", name: "Improvement", color: "oklch(0.63 0.12 245)" },
	{ id: "design", name: "Design", color: "oklch(0.62 0.15 305)" },
	{ id: "performance", name: "Performance", color: "oklch(0.74 0.14 75)" },
	{ id: "docs", name: "Docs", color: "oklch(0.62 0.02 250)" },
];

/** Finds a label by id. */
export function findLabel(id: string): Label | undefined {
	return LABELS.find((label) => label.id === id);
}

/** How a project is tracking, as its lead last said. */
export type Health = "on-track" | "at-risk" | "off-track" | "planned" | "completed";

/** Each health's name. */
export const HEALTH_NAMES: Record<Health, string> = {
	"on-track": "On track",
	"at-risk": "At risk",
	"off-track": "Off track",
	planned: "Planned",
	completed: "Completed",
};

/** A project: dates, a lead, and closed work from before the demo's issues. */
export interface Project {
	id: string;
	name: string;
	team: string;
	lead: string;
	summary: string;
	start: string;
	target: string;
	/** When the lead now expects it to finish, when that is past `target`. */
	projected?: string;
	health: Health;
	/** Estimate points finished and planned outside the demo's issues. */
	baseline: { done: number; total: number };
	/** The glyph's hue on the roadmap and the project list. */
	hue: number;
}

/** Saltmarsh's projects, active first. */
export const PROJECTS: readonly Project[] = [
	{
		id: "checkout-v2",
		name: "Checkout v2",
		team: "web",
		lead: "adaeze",
		summary: "One-page checkout with saved carts, wallets and a receipt that reads like a letter.",
		start: "2026-09-14",
		target: "2026-12-11",
		health: "on-track",
		baseline: { done: 21, total: 30 },
		hue: 150,
	},
	{
		id: "offline-drafts",
		name: "Offline drafts",
		team: "web",
		lead: "tomasz",
		summary: "Write on a train: drafts save to the device and sync when the network comes back.",
		start: "2026-10-05",
		target: "2026-11-27",
		projected: "2026-12-18",
		health: "at-risk",
		baseline: { done: 6, total: 14 },
		hue: 245,
	},
	{
		id: "search-revamp",
		name: "Search revamp",
		team: "plat",
		lead: "rafael",
		summary: "Typo-tolerant search over every record, ranked by what the person opened last.",
		start: "2026-08-31",
		target: "2026-11-06",
		projected: "2026-11-25",
		health: "off-track",
		baseline: { done: 24, total: 28 },
		hue: 75,
	},
	{
		id: "billing-ledger",
		name: "Billing ledger",
		team: "plat",
		lead: "mei",
		summary: "An append-only ledger behind every invoice, so a refund never rewrites history.",
		start: "2026-11-02",
		target: "2027-01-29",
		health: "on-track",
		baseline: { done: 2, total: 26 },
		hue: 25,
	},
	{
		id: "design-tokens",
		name: "Design tokens",
		team: "web",
		lead: "ilse",
		summary: "One token file for colour, type and spacing, shared by the site and the apps.",
		start: "2026-12-07",
		target: "2027-02-19",
		health: "planned",
		baseline: { done: 0, total: 18 },
		hue: 305,
	},
	{
		id: "edge-cache",
		name: "Edge cache",
		team: "plat",
		lead: "jonah",
		summary: "Serve every public page from the edge and purge it the moment it changes.",
		start: "2027-01-11",
		target: "2027-03-26",
		health: "planned",
		baseline: { done: 0, total: 20 },
		hue: 200,
	},
	{
		id: "onboarding-tour",
		name: "Onboarding tour",
		team: "web",
		lead: "mei",
		summary: "A five-step tour that ends with the new account's first project made.",
		start: "2026-07-06",
		target: "2026-09-25",
		health: "completed",
		baseline: { done: 16, total: 16 },
		hue: 340,
	},
	{
		id: "status-page",
		name: "Status page",
		team: "plat",
		lead: "jonah",
		summary: "A public page with ninety days of uptime and every incident's timeline.",
		start: "2026-08-03",
		target: "2026-10-02",
		health: "completed",
		baseline: { done: 12, total: 12 },
		hue: 110,
	},
];

/** Finds a project by id. */
export function findProject(id: string | undefined): Project | undefined {
	return PROJECTS.find((project) => project.id === id);
}

/** A cycle: a team's two weeks, with the points scoped and finished at the end of each day. */
export interface Cycle {
	id: string;
	team: string;
	number: number;
	start: string;
	end: string;
	/** Scope and finished points at the end of each day before today. */
	history: { scope: number[]; done: number[] };
}

/** Each team's cycles, oldest first. */
export const CYCLES: readonly Cycle[] = [
	{
		id: "web-23",
		team: "web",
		number: 23,
		start: "2026-10-19",
		end: "2026-11-01",
		history: {
			scope: [24, 24, 26, 26, 26, 28, 28, 28, 28, 29, 29, 29, 29, 29],
			done: [0, 2, 3, 5, 8, 8, 8, 11, 14, 17, 20, 23, 26, 27],
		},
	},
	{
		id: "web-24",
		team: "web",
		number: 24,
		start: "2026-11-02",
		end: "2026-11-15",
		history: {
			scope: [22, 22, 24, 25, 25, 25, 25, 27, 27, 28],
			done: [0, 1, 3, 4, 6, 6, 6, 8, 10, 11],
		},
	},
	{
		id: "web-25",
		team: "web",
		number: 25,
		start: "2026-11-16",
		end: "2026-11-29",
		history: { scope: [], done: [] },
	},
	{
		id: "plat-11",
		team: "plat",
		number: 11,
		start: "2026-10-26",
		end: "2026-11-08",
		history: {
			scope: [18, 18, 18, 20, 20, 20, 20, 21, 21, 21, 21, 21, 21, 21],
			done: [0, 0, 2, 4, 5, 5, 5, 7, 10, 12, 14, 16, 18, 19],
		},
	},
	{
		id: "plat-12",
		team: "plat",
		number: 12,
		start: "2026-11-09",
		end: "2026-11-22",
		history: { scope: [17, 17, 19], done: [0, 2, 3] },
	},
];

/** Finds a cycle by id. */
export function findCycle(id: string | undefined): Cycle | undefined {
	return CYCLES.find((cycle) => cycle.id === id);
}

/** Where a cycle sits against today. */
export function cyclePhase(cycle: Cycle): "past" | "current" | "upcoming" {
	if (cycle.end < TODAY) return "past";
	if (cycle.start > TODAY) return "upcoming";
	return "current";
}

/** A team's current cycle. */
export function currentCycle(team: string): Cycle | undefined {
	return CYCLES.find((cycle) => cycle.team === team && cyclePhase(cycle) === "current");
}

/** One comment under an issue. */
export interface Comment {
	id: string;
	author: string;
	at: string;
	body: string;
}

/** One change in an issue's history, the way its feed tells it. */
export interface Change {
	at: string;
	actor: string;
	field: "status" | "priority" | "assignee" | "created";
	to?: string;
}

/** An issue as the fixtures hold it, before anything a visitor changed. */
export interface Issue {
	id: string;
	team: string;
	title: string;
	status: StatusId;
	priority: PriorityId;
	assignee?: string;
	labels: string[];
	estimate?: number;
	project?: string;
	cycle?: string;
	parent?: string;
	description: string[];
	createdBy: string;
	createdAt: string;
	updatedAt: string;
	changes?: Change[];
	comments?: Comment[];
}

/** Every issue, newest number last within each team. */
export const ISSUES: readonly Issue[] = [
	{
		id: "WEB-118",
		team: "web",
		title: "Saved carts survive a sign-out",
		status: "started",
		priority: 2,
		assignee: "ilse",
		labels: ["feature"],
		estimate: 5,
		project: "checkout-v2",
		cycle: "web-24",
		description: [
			"A cart someone fills while signed out is lost when they sign in on another device. Keep it on the account the moment they sign in, and merge it with the cart already there.",
			"Merging keeps the larger quantity of a line both carts hold, and never drops a line.",
		],
		createdBy: "adaeze",
		createdAt: "2026-10-27T10:12:00Z",
		updatedAt: "2026-11-12T09:40:00Z",
		changes: [{ at: "2026-11-03T09:00:00Z", actor: "ilse", field: "status", to: "started" }],
		comments: [
			{
				id: "c-118-1",
				author: "adaeze",
				at: "2026-11-10T14:20:00Z",
				body: "Design for the merge notice is in the Checkout file, page 4. One line, no modal.",
			},
			{
				id: "c-118-2",
				author: "ilse",
				at: "2026-11-12T09:40:00Z",
				body: "Merge works end to end. Writing the tests for a cart with a removed product next.",
			},
		],
	},
	{
		id: "WEB-119",
		team: "web",
		title: "Merge the guest cart into the account cart",
		status: "done",
		priority: 2,
		assignee: "ilse",
		labels: ["feature"],
		estimate: 3,
		project: "checkout-v2",
		cycle: "web-24",
		parent: "WEB-118",
		description: ["Lines both carts hold keep the larger quantity."],
		createdBy: "ilse",
		createdAt: "2026-11-03T09:10:00Z",
		updatedAt: "2026-11-10T16:00:00Z",
		changes: [{ at: "2026-11-10T16:00:00Z", actor: "ilse", field: "status", to: "done" }],
	},
	{
		id: "WEB-120",
		team: "web",
		title: "Show a one-line notice after a merge",
		status: "review",
		priority: 3,
		assignee: "adaeze",
		labels: ["design"],
		estimate: 1,
		project: "checkout-v2",
		cycle: "web-24",
		parent: "WEB-118",
		description: ["“We added 2 items from your last visit.” with an Undo link."],
		createdBy: "ilse",
		createdAt: "2026-11-03T09:12:00Z",
		updatedAt: "2026-11-11T17:30:00Z",
	},
	{
		id: "WEB-121",
		team: "web",
		title: "Drop lines whose product was removed",
		status: "todo",
		priority: 3,
		assignee: "ilse",
		labels: ["bug"],
		estimate: 2,
		project: "checkout-v2",
		cycle: "web-24",
		parent: "WEB-118",
		description: ["A product removed from the catalogue leaves a line that can't be checked out."],
		createdBy: "ilse",
		createdAt: "2026-11-03T09:14:00Z",
		updatedAt: "2026-11-03T09:14:00Z",
	},
	{
		id: "WEB-124",
		team: "web",
		title: "Wallet buttons jump when the page finishes loading",
		status: "todo",
		priority: 1,
		assignee: "tomasz",
		labels: ["bug", "performance"],
		estimate: 2,
		project: "checkout-v2",
		cycle: "web-24",
		description: [
			"The express wallet row renders empty, then grows by 48px once the wallet script answers, pushing the order summary down mid-read.",
			"Reserve the row's height from the first paint.",
		],
		createdBy: "mei",
		createdAt: "2026-11-09T11:00:00Z",
		updatedAt: "2026-11-11T08:15:00Z",
		comments: [
			{
				id: "c-124-1",
				author: "mei",
				at: "2026-11-09T11:02:00Z",
				body: "Measured a layout shift of 0.21 on a mid-range phone. This is most of our score.",
			},
		],
	},
	{
		id: "WEB-126",
		team: "web",
		title: "Receipt email reads like a letter",
		status: "backlog",
		priority: 4,
		labels: ["design"],
		estimate: 3,
		project: "checkout-v2",
		description: ["Plain text first, the order as a short paragraph, totals at the end."],
		createdBy: "adaeze",
		createdAt: "2026-10-30T15:00:00Z",
		updatedAt: "2026-10-30T15:00:00Z",
	},
	{
		id: "WEB-127",
		team: "web",
		title: "Address form keeps the country when it resets",
		status: "done",
		priority: 3,
		assignee: "tomasz",
		labels: ["bug"],
		estimate: 1,
		project: "checkout-v2",
		cycle: "web-24",
		description: ["Clearing the form sets the country back to the first in the list."],
		createdBy: "tomasz",
		createdAt: "2026-11-02T10:00:00Z",
		updatedAt: "2026-11-05T12:00:00Z",
	},
	{
		id: "WEB-130",
		team: "web",
		title: "Queue edits while offline",
		status: "started",
		priority: 2,
		assignee: "tomasz",
		labels: ["feature"],
		estimate: 5,
		project: "offline-drafts",
		cycle: "web-24",
		description: [
			"Every edit made without a connection goes into a queue on the device, in order, and replays when the connection returns.",
		],
		createdBy: "tomasz",
		createdAt: "2026-10-12T09:00:00Z",
		updatedAt: "2026-11-11T18:00:00Z",
		comments: [
			{
				id: "c-130-1",
				author: "tomasz",
				at: "2026-11-11T18:00:00Z",
				body: "Replay is in. Conflicts are the hard part, and they'll push this past the target date.",
			},
		],
	},
	{
		id: "WEB-131",
		team: "web",
		title: "Resolve a conflict between two devices",
		status: "todo",
		priority: 2,
		assignee: "tomasz",
		labels: ["feature"],
		estimate: 8,
		project: "offline-drafts",
		cycle: "web-25",
		description: ["Show both versions side by side and let the writer keep either, or both."],
		createdBy: "tomasz",
		createdAt: "2026-10-12T09:05:00Z",
		updatedAt: "2026-11-11T18:05:00Z",
	},
	{
		id: "WEB-132",
		team: "web",
		title: "Say “Saved on this device” while offline",
		status: "review",
		priority: 3,
		assignee: "mei",
		labels: ["design"],
		estimate: 1,
		project: "offline-drafts",
		cycle: "web-24",
		description: ["The save status reads “Saved on this device” and turns to “Saved” once synced."],
		createdBy: "mei",
		createdAt: "2026-10-20T10:00:00Z",
		updatedAt: "2026-11-12T08:00:00Z",
	},
	{
		id: "WEB-133",
		team: "web",
		title: "Drafts list shows which drafts are not synced",
		status: "backlog",
		priority: 0,
		labels: ["improvement"],
		estimate: 2,
		project: "offline-drafts",
		description: ["A small dot beside each draft still waiting to sync."],
		createdBy: "ilse",
		createdAt: "2026-10-28T13:00:00Z",
		updatedAt: "2026-10-28T13:00:00Z",
	},
	{
		id: "WEB-135",
		team: "web",
		title: "Keyboard focus lost after closing the share sheet",
		status: "todo",
		priority: 2,
		labels: ["bug"],
		estimate: 1,
		cycle: "web-24",
		description: [
			"Focus lands on the page body instead of the Share button that opened the sheet.",
		],
		createdBy: "jonah",
		createdAt: "2026-11-10T09:30:00Z",
		updatedAt: "2026-11-10T09:30:00Z",
	},
	{
		id: "WEB-136",
		team: "web",
		title: "Pick the token names for colour",
		status: "backlog",
		priority: 3,
		assignee: "ilse",
		labels: ["design"],
		estimate: 2,
		project: "design-tokens",
		description: ["Name tokens by role (surface, text, border), never by hue."],
		createdBy: "ilse",
		createdAt: "2026-11-06T10:00:00Z",
		updatedAt: "2026-11-06T10:00:00Z",
	},
	{
		id: "WEB-137",
		team: "web",
		title: "Dark mode chart colours fail contrast",
		status: "todo",
		priority: 2,
		assignee: "adaeze",
		labels: ["bug", "design"],
		estimate: 2,
		cycle: "web-24",
		description: ["The third and fifth series fall under 3:1 against the dark surface."],
		createdBy: "adaeze",
		createdAt: "2026-11-08T16:00:00Z",
		updatedAt: "2026-11-11T10:00:00Z",
	},
	{
		id: "WEB-138",
		team: "web",
		title: "Document the checkout events for analytics",
		status: "canceled",
		priority: 4,
		labels: ["docs"],
		estimate: 1,
		project: "checkout-v2",
		description: ["Superseded by the events catalogue the data team now owns."],
		createdBy: "mei",
		createdAt: "2026-10-15T10:00:00Z",
		updatedAt: "2026-11-04T10:00:00Z",
	},
	{
		id: "WEB-139",
		team: "web",
		title: "Onboarding tour skips step three on Safari",
		status: "done",
		priority: 1,
		assignee: "mei",
		labels: ["bug"],
		estimate: 2,
		project: "onboarding-tour",
		cycle: "web-23",
		description: ["The highlight never finds its target, so the tour advances twice."],
		createdBy: "mei",
		createdAt: "2026-09-20T10:00:00Z",
		updatedAt: "2026-09-24T10:00:00Z",
	},
	{
		id: "WEB-140",
		team: "web",
		title: "Coupon field accepts a code twice",
		status: "started",
		priority: 1,
		assignee: "ilse",
		labels: ["bug"],
		estimate: 1,
		project: "checkout-v2",
		cycle: "web-24",
		description: [
			"Pressing Apply twice in quick succession applies the discount twice. The server rejects it at payment, after the person has seen the lower total.",
		],
		createdBy: "rafael",
		createdAt: "2026-11-11T13:00:00Z",
		updatedAt: "2026-11-12T11:00:00Z",
		comments: [
			{
				id: "c-140-1",
				author: "rafael",
				at: "2026-11-11T13:05:00Z",
				body: "@Ilse this is the one support flagged this morning. Two orders so far.",
			},
		],
	},
	{
		id: "WEB-141",
		team: "web",
		title: "Order summary reads totals to a screen reader",
		status: "todo",
		priority: 3,
		assignee: "adaeze",
		labels: ["improvement"],
		estimate: 2,
		project: "checkout-v2",
		cycle: "web-25",
		description: ["Announce the new total once after a quantity change, not every line."],
		createdBy: "adaeze",
		createdAt: "2026-11-11T15:00:00Z",
		updatedAt: "2026-11-11T15:00:00Z",
	},
	{
		id: "PLT-204",
		team: "plat",
		title: "Typo-tolerant matching for names",
		status: "review",
		priority: 2,
		assignee: "rafael",
		labels: ["feature"],
		estimate: 5,
		project: "search-revamp",
		cycle: "plat-12",
		description: [
			"Match names within one edit for words of five letters or more, two edits from nine.",
			"Exact matches still rank first.",
		],
		createdBy: "rafael",
		createdAt: "2026-10-01T09:00:00Z",
		updatedAt: "2026-11-12T10:30:00Z",
		comments: [
			{
				id: "c-204-1",
				author: "jonah",
				at: "2026-11-12T10:30:00Z",
				body: "Reviewing now. The index grew 18%, which is within the budget we set.",
			},
		],
	},
	{
		id: "PLT-205",
		team: "plat",
		title: "Rank by what the person opened last",
		status: "started",
		priority: 2,
		assignee: "rafael",
		labels: ["feature"],
		estimate: 3,
		project: "search-revamp",
		cycle: "plat-12",
		description: ["Blend recency of opens into the score, decaying over fourteen days."],
		createdBy: "rafael",
		createdAt: "2026-10-01T09:05:00Z",
		updatedAt: "2026-11-11T16:00:00Z",
	},
	{
		id: "PLT-206",
		team: "plat",
		title: "Search index rebuild blocks writes for 40 seconds",
		status: "todo",
		priority: 1,
		assignee: "jonah",
		labels: ["bug", "performance"],
		estimate: 3,
		project: "search-revamp",
		cycle: "plat-12",
		description: ["Build the new index beside the old one and swap them in one step."],
		createdBy: "jonah",
		createdAt: "2026-11-10T08:00:00Z",
		updatedAt: "2026-11-12T07:45:00Z",
	},
	{
		id: "PLT-207",
		team: "plat",
		title: "Ledger entries are append-only",
		status: "started",
		priority: 2,
		assignee: "mei",
		labels: ["feature"],
		estimate: 5,
		project: "billing-ledger",
		cycle: "plat-12",
		description: [
			"A refund adds a reversing entry; nothing updates or deletes a posted entry.",
			"The invoice total is the sum of its entries, always.",
		],
		createdBy: "mei",
		createdAt: "2026-11-02T09:00:00Z",
		updatedAt: "2026-11-12T12:00:00Z",
	},
	{
		id: "PLT-208",
		team: "plat",
		title: "Backfill the ledger from past invoices",
		status: "todo",
		priority: 3,
		assignee: "mei",
		labels: ["feature"],
		estimate: 5,
		project: "billing-ledger",
		parent: "PLT-207",
		description: ["One entry per invoice line, dated when the invoice was issued."],
		createdBy: "mei",
		createdAt: "2026-11-02T09:10:00Z",
		updatedAt: "2026-11-02T09:10:00Z",
	},
	{
		id: "PLT-209",
		team: "plat",
		title: "Reject an entry that would unbalance an invoice",
		status: "done",
		priority: 2,
		assignee: "mei",
		labels: ["feature"],
		estimate: 2,
		project: "billing-ledger",
		cycle: "plat-12",
		parent: "PLT-207",
		description: ["Every posting checks the invoice still sums to zero against its payments."],
		createdBy: "mei",
		createdAt: "2026-11-02T09:12:00Z",
		updatedAt: "2026-11-10T15:00:00Z",
	},
	{
		id: "PLT-210",
		team: "plat",
		title: "Status page shows the wrong time zone for incidents",
		status: "done",
		priority: 3,
		assignee: "jonah",
		labels: ["bug"],
		estimate: 1,
		project: "status-page",
		cycle: "plat-11",
		description: ["Times are written in UTC without saying so."],
		createdBy: "jonah",
		createdAt: "2026-09-28T10:00:00Z",
		updatedAt: "2026-10-01T10:00:00Z",
	},
	{
		id: "PLT-211",
		team: "plat",
		title: "Purge a cached page the moment it changes",
		status: "backlog",
		priority: 3,
		assignee: "jonah",
		labels: ["feature", "performance"],
		estimate: 5,
		project: "edge-cache",
		description: [
			"Each write publishes the paths it touched; the edge drops them within a second.",
		],
		createdBy: "jonah",
		createdAt: "2026-11-05T10:00:00Z",
		updatedAt: "2026-11-05T10:00:00Z",
	},
	{
		id: "PLT-212",
		team: "plat",
		title: "Slow query on the activity feed for large teams",
		status: "todo",
		priority: 2,
		labels: ["performance"],
		estimate: 3,
		cycle: "plat-12",
		description: [
			"Teams over 200 people wait 2.4s for the feed. Add the missing index on (team, at).",
		],
		createdBy: "rafael",
		createdAt: "2026-11-11T09:00:00Z",
		updatedAt: "2026-11-11T09:00:00Z",
	},
	{
		id: "PLT-213",
		team: "plat",
		title: "Write the runbook for a failed ledger posting",
		status: "backlog",
		priority: 4,
		labels: ["docs"],
		estimate: 1,
		project: "billing-ledger",
		description: ["What to check, who to page, and how to replay the posting."],
		createdBy: "mei",
		createdAt: "2026-11-06T10:00:00Z",
		updatedAt: "2026-11-06T10:00:00Z",
	},
	{
		id: "PLT-214",
		team: "plat",
		title: "API returns 500 for an empty search",
		status: "review",
		priority: 1,
		assignee: "ilse",
		labels: ["bug"],
		estimate: 1,
		project: "search-revamp",
		cycle: "plat-12",
		description: ["An empty query should answer an empty list with 200."],
		createdBy: "jonah",
		createdAt: "2026-11-11T12:00:00Z",
		updatedAt: "2026-11-12T13:10:00Z",
	},
	{
		id: "PLT-215",
		team: "plat",
		title: "Rotate the signing keys every 90 days",
		status: "todo",
		priority: 3,
		assignee: "ilse",
		labels: ["improvement"],
		estimate: 2,
		cycle: "plat-12",
		description: ["Publish the next key a week before it signs anything."],
		createdBy: "jonah",
		createdAt: "2026-11-09T10:00:00Z",
		updatedAt: "2026-11-09T10:00:00Z",
	},
];

/** Something that happened to the signed-in person's work, as the inbox lists it. */
export interface Notice {
	id: string;
	issue: string;
	actor: string;
	kind: "mention" | "assigned" | "comment" | "status" | "review";
	at: string;
	text: string;
	unread: boolean;
}

/** The inbox, newest first. */
export const NOTICES: readonly Notice[] = [
	{
		id: "n-1",
		issue: "PLT-214",
		actor: "jonah",
		kind: "review",
		at: "2026-11-12T13:10:00Z",
		text: "asked you to review",
		unread: true,
	},
	{
		id: "n-2",
		issue: "WEB-140",
		actor: "rafael",
		kind: "mention",
		at: "2026-11-11T13:05:00Z",
		text: "mentioned you",
		unread: true,
	},
	{
		id: "n-3",
		issue: "WEB-118",
		actor: "adaeze",
		kind: "comment",
		at: "2026-11-10T14:20:00Z",
		text: "commented",
		unread: true,
	},
	{
		id: "n-4",
		issue: "PLT-215",
		actor: "jonah",
		kind: "assigned",
		at: "2026-11-09T10:00:00Z",
		text: "assigned you",
		unread: false,
	},
	{
		id: "n-5",
		issue: "WEB-120",
		actor: "adaeze",
		kind: "status",
		at: "2026-11-11T17:30:00Z",
		text: "moved to In Review",
		unread: false,
	},
	{
		id: "n-6",
		issue: "WEB-136",
		actor: "ilse",
		kind: "assigned",
		at: "2026-11-06T10:00:00Z",
		text: "assigned you",
		unread: false,
	},
];

/** A saved view: a named filter across every team. */
export interface SavedView {
	id: string;
	name: string;
	description: string;
}

/** The workspace's saved views. */
export const VIEWS: readonly SavedView[] = [
	{ id: "urgent", name: "Urgent and high", description: "Open issues at urgent or high priority." },
	{ id: "unassigned-bugs", name: "Unassigned bugs", description: "Bugs no one has picked up." },
	{ id: "in-review", name: "In review", description: "Everything waiting on a reviewer." },
];

/** Finds a saved view by id. */
export function findView(id: string | undefined): SavedView | undefined {
	return VIEWS.find((view) => view.id === id);
}
