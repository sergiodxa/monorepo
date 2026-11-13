/**
 * Delta's seeded issues, with the repository's labels and milestones. The people and the talk
 * are invented, but every bug they report is real: each cites the code it is about through a
 * content anchor, so the citation follows its lines and reads Outdated once they change.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A repository label. */
export interface RepoLabel {
	id: string;
	name: string;
	/** Any CSS colour, as the label was defined. */
	color: string;
	description: string;
}

/** Every label, in the order the pickers list them. */
export const LABELS: readonly RepoLabel[] = [
	{ id: "bug", name: "bug", color: "#d73a4a", description: "Something isn't working" },
	{
		id: "enhancement",
		name: "enhancement",
		color: "#2f81f7",
		description: "A new feature or request",
	},
	{
		id: "a11y",
		name: "accessibility",
		color: "#8250df",
		description: "Keyboard, screen readers, contrast",
	},
	{ id: "phone", name: "phone", color: "#bf8700", description: "Shows up at 375px" },
	{ id: "diff", name: "diff", color: "#1a7f37", description: "Diffs, hunks and review threads" },
	{ id: "docs", name: "documentation", color: "#0075ca", description: "README and guides" },
	{ id: "perf", name: "performance", color: "#e16f24", description: "Slower than it should be" },
	{
		id: "good-first",
		name: "good first issue",
		color: "#7057ff",
		description: "Small and well scoped",
	},
];

/** A milestone issues and pull requests are planned against. */
export interface Milestone {
	id: string;
	title: string;
	description: string;
}

/** Every milestone, the nearest first. */
export const MILESTONES: readonly Milestone[] = [
	{ id: "review", title: "Code review", description: "Pull requests, review threads and merging" },
	{
		id: "phones",
		title: "Phone polish",
		description: "Every screen at 375px with no sideways scroll",
	},
	{ id: "v1", title: "Delta 1.0", description: "All sixteen screens shipped" },
];

/**
 * A piece of a comment's body: a paragraph (with `` `code` ``, `#57` and `@handle` read as
 * such), a bulleted list, or a citation of real lines by anchor id.
 */
export type Block = string | { list: string[] } | { cite: string };

/** One thing that happened to an issue or pull request, drawn as a line on its timeline. */
export type SeedEvent =
	| { kind: "labeled" | "unlabeled"; label: string }
	| { kind: "assigned" | "unassigned"; person: string }
	| { kind: "milestoned"; milestone: string }
	| { kind: "closed"; reason: "completed" | "not_planned"; by?: number }
	| { kind: "reopened" }
	| { kind: "referenced"; pull: number }
	| { kind: "renamed"; from: string };

/** A comment or event on a timeline: who, how many hours before the newest commit, and what. */
export type SeedEntry =
	| { type: "comment"; id: string; author: string; ago: number; body: Block[] }
	| ({ type: "event"; actor: string; ago: number } & SeedEvent);

/** An issue as the seed writes it. */
export interface IssueSeed {
	number: number;
	title: string;
	author: string;
	/** Hours before the newest commit the issue was opened. */
	ago: number;
	labels: string[];
	assignees: string[];
	milestone?: string;
	body: Block[];
	/** Comments and events after the opening post, oldest first. */
	timeline: SeedEntry[];
}

/** Every seeded issue, by number, newest first. */
export const ISSUES: readonly IssueSeed[] = [
	{
		number: 54,
		title: "File sizes past a megabyte read as thousands of kilobytes",
		author: "kenji",
		ago: 5,
		labels: ["bug", "good-first"],
		assignees: [],
		milestone: "v1",
		body: [
			"A file header writes its size through `formatBytes`, which stops at kilobytes. A 3 MB file would read `3072.00 KB`, where every other code host writes `3 MB`.",
			{ cite: "format-bytes" },
			"Nothing Delta hosts is that large yet, so this is cheap to fix before it shows: one more branch for megabytes, and a test beside the others in the data module.",
		],
		timeline: [{ type: "event", actor: "kenji", ago: 5, kind: "labeled", label: "good-first" }],
	},
	{
		number: 53,
		title: "Avatars draw one letter for a person with one name",
		author: "ines",
		ago: 20,
		labels: ["bug"],
		assignees: ["ines"],
		milestone: "v1",
		body: [
			"`initials` takes the first letter of the first and last names, so a person with one name, like a bot or a handle used as a name, gets a single letter in a circle sized for two.",
			{ cite: "initials" },
			"GitHub falls back to the first two letters of the one name. I'd do the same here.",
		],
		timeline: [
			{ type: "event", actor: "ines", ago: 19, kind: "assigned", person: "ines" },
			{
				type: "comment",
				id: "c-53-1",
				author: "mara",
				ago: 14,
				body: [
					"Two letters reads better, agreed. Keep the tile's font size as it is: two capitals already fill it at 18px.",
				],
			},
		],
	},
	{
		number: 52,
		title: "The file pane hides on tablets, between 48 and 64rem",
		author: "priya",
		ago: 30,
		labels: ["enhancement", "phone"],
		assignees: ["mara"],
		milestone: "phones",
		body: [
			"On an iPad in portrait the code view takes the whole width and the tree is gone, even though there's room for a narrow pane. The pane only shows from 64rem:",
			{ cite: "wide-pane" },
			"Could the pane collapse to a rail of folder icons below that width instead of disappearing?",
		],
		timeline: [
			{ type: "event", actor: "sergiodxa", ago: 28, kind: "labeled", label: "phone" },
			{ type: "event", actor: "sergiodxa", ago: 28, kind: "assigned", person: "mara" },
			{
				type: "comment",
				id: "c-52-1",
				author: "mara",
				ago: 26,
				body: [
					"A rail is a lot of chrome for a tree. I'd rather keep the breakpoint and make `t` more visible on tablets: the finder already reaches every file.",
				],
			},
			{
				type: "comment",
				id: "c-52-2",
				author: "priya",
				ago: 22,
				body: ['Fair. A visible "Go to file" button in the header would cover it for me.'],
			},
		],
	},
	{
		number: 51,
		title: "Avatar colours cluster for names that start alike",
		author: "mara",
		ago: 52,
		labels: ["a11y"],
		assignees: [],
		body: [
			"The hue comes from a rolling hash of the name, mod 360. Names that share a long prefix land a few degrees apart, so two people in one commit row can look like the same person:",
			{ cite: "hue-of" },
			"Mixing the length into the hash, or picking from a fixed set of distinguishable hues, would keep neighbours apart.",
		],
		timeline: [],
	},
	{
		number: 50,
		title: "Commits group by UTC day, not the reader's",
		author: "tlindqvist",
		ago: 75,
		labels: ["bug"],
		assignees: ["tlindqvist"],
		milestone: "v1",
		body: [
			"A commit made at 9pm in New York shows under the next day, because the commits list groups on the UTC date:",
			{ cite: "utc-days" },
			"The server can't know the reader's zone on the first paint, so I'd keep UTC on the server and say so in the heading, or regroup in the browser.",
		],
		timeline: [
			{ type: "event", actor: "tlindqvist", ago: 74, kind: "assigned", person: "tlindqvist" },
			{
				type: "comment",
				id: "c-50-1",
				author: "sergiodxa",
				ago: 60,
				body: [
					"Let's keep UTC and add \"(UTC)\" to each day heading. Regrouping after hydration moves rows under the reader's eyes.",
				],
			},
		],
	},
	{
		number: 49,
		title: 'Let a reader choose when a file waits behind "Load diff"',
		author: "kenji",
		ago: 96,
		labels: ["enhancement", "diff"],
		assignees: [],
		milestone: "review",
		body: [
			"A file past 400 changed lines renders closed behind Load diff. That's right for a generated file, but a reviewer working through a large refactor has to open every card:",
			{ cite: "large-diff" },
			'A setting under the view switch ("Load every diff") kept in a cookie would do it.',
		],
		timeline: [{ type: "event", actor: "kenji", ago: 96, kind: "milestoned", milestone: "review" }],
	},
	{
		number: 48,
		title: "Expanding context should keep the reader's place",
		author: "ines",
		ago: 140,
		labels: ["diff"],
		assignees: ["sergiodxa"],
		milestone: "review",
		body: [
			"Pressing a hunk's expand arrow reloads the page and jumps back to the top of the file. On a long file that loses my place every time.",
		],
		timeline: [
			{ type: "event", actor: "sergiodxa", ago: 139, kind: "assigned", person: "sergiodxa" },
			{ type: "event", actor: "sergiodxa", ago: 30, kind: "referenced", pull: 57 },
			{
				type: "comment",
				id: "c-48-1",
				author: "sergiodxa",
				ago: 29,
				body: [
					"With script, the expand link now redraws `main` in place and leaves the scroll alone, with no history entry for each press:",
					{ cite: "in-place" },
				],
			},
		],
	},
	{
		number: 42,
		title: "Show which lines an issue cites, even after the code moves",
		author: "sergiodxa",
		ago: 210,
		labels: ["enhancement", "docs"],
		assignees: ["sergiodxa", "mara"],
		milestone: "v1",
		body: [
			"Issues and review threads quote code by line number, and line numbers drift with every commit. Delta should cite code by content instead: find the line that contains a phrase, and quote it with a link that paints the range.",
			"This issue is its own example. The record that seeds it is right here:",
			{ cite: "issue-42" },
			"When those lines change, the citation should say Outdated instead of pointing at the wrong code.",
		],
		timeline: [
			{ type: "event", actor: "sergiodxa", ago: 209, kind: "assigned", person: "mara" },
			{
				type: "comment",
				id: "c-42-1",
				author: "mara",
				ago: 180,
				body: [
					"Content anchors are resolved when the site builds, so a citation costs nothing per request. The README says how the history gets there:",
					{ cite: "readme-how" },
				],
			},
			{
				type: "comment",
				id: "c-42-2",
				author: "kenji",
				ago: 150,
				body: [
					"One edge case: a phrase that appears twice. The anchor takes the first match, so seeds should quote something distinctive, like a signature rather than a closing brace.",
				],
			},
			{ type: "event", actor: "sergiodxa", ago: 120, kind: "labeled", label: "docs" },
		],
	},
	{
		number: 41,
		title: "The finder's results should open with Enter on the first match",
		author: "priya",
		ago: 260,
		labels: ["enhancement", "a11y"],
		assignees: [],
		body: [
			"After typing in Go to file, Enter does nothing until I arrow down. Most finders open the first match on Enter.",
		],
		timeline: [
			{
				type: "comment",
				id: "c-41-1",
				author: "ines",
				ago: 250,
				body: ["The command menu's finder already does this; only the no-script page doesn't."],
			},
		],
	},
	{
		number: 39,
		title: "Blame should say how old each commit is at a glance",
		author: "tlindqvist",
		ago: 330,
		labels: ["enhancement"],
		assignees: ["kenji"],
		milestone: "v1",
		body: [
			"The blame gutter names the commit but not its age. GitHub tints the gutter by age, newest warmest; the theme already defines `--code-age-1` to `--code-age-5`.",
		],
		timeline: [
			{ type: "event", actor: "sergiodxa", ago: 300, kind: "assigned", person: "kenji" },
			{ type: "event", actor: "kenji", ago: 120, kind: "closed", reason: "completed" },
		],
	},
	{
		number: 37,
		title: "Line links scroll the line under the sticky top bar",
		author: "mara",
		ago: 400,
		labels: ["bug", "phone"],
		assignees: ["sergiodxa"],
		milestone: "phones",
		body: [
			"Opening `shell.tsx#L12` scrolls line 12 to the very top, where the 56px top bar covers it.",
		],
		timeline: [
			{ type: "event", actor: "sergiodxa", ago: 390, kind: "assigned", person: "sergiodxa" },
			{
				type: "comment",
				id: "c-37-1",
				author: "sergiodxa",
				ago: 200,
				body: ["Fixed with a scroll margin on every line row, the height of the top bar."],
			},
			{ type: "event", actor: "sergiodxa", ago: 200, kind: "closed", reason: "completed" },
		],
	},
	{
		number: 34,
		title: "Syntax colours for Markdown in the README",
		author: "ines",
		ago: 520,
		labels: ["enhancement"],
		assignees: [],
		body: [
			"Could the README's code view highlight Markdown? Right now headings and lists read as plain text.",
		],
		timeline: [
			{
				type: "comment",
				id: "c-34-1",
				author: "kenji",
				ago: 500,
				body: [
					"The README renders as Markdown on the repository home, which is where people read it. The code view stays a code view.",
				],
			},
			{ type: "event", actor: "sergiodxa", ago: 498, kind: "closed", reason: "not_planned" },
		],
	},
	{
		number: 31,
		title: "Keyboard help should list the tree's arrow keys",
		author: "mara",
		ago: 610,
		labels: ["a11y", "good-first"],
		assignees: [],
		body: ["The tree moves with the arrow keys, but `?` doesn't mention them."],
		timeline: [{ type: "event", actor: "ines", ago: 590, kind: "closed", reason: "completed" }],
	},
];

/** Finds a label by id. */
export function findLabel(id: string): RepoLabel | undefined {
	return LABELS.find((label) => label.id === id);
}

/** Finds a milestone by id. */
export function findMilestone(id: string | undefined): Milestone | undefined {
	return MILESTONES.find((milestone) => milestone.id === id);
}
