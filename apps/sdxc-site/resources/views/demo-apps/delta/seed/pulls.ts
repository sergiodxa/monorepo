/**
 * Delta's seeded pull requests: who opened each, its conversation, its reviews and the threads
 * they left on lines, and its checks. The code is real: each pull request is a commit range
 * from `ranges.ts`, and every thread finds its line by content in that range's diff.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Block, SeedEntry } from "./issues";

/** The commit that added Delta, which the first reviews were left against. */
const ADDED = "feat(sdxc-site): Add Delta, a code host that browses its own source";

/** A comment in a review thread, its time in hours after the pull request's last commit. */
export interface ThreadCommentSeed {
	id: string;
	author: string;
	at: number;
	body: Block[];
}

/** A conversation on lines of a pull request's files. */
export interface ThreadSeed {
	id: string;
	path: string;
	/** Text the first cited line contains on the new side. */
	match: string;
	/** @default 1 */
	span?: number;
	/** Subject of the commit the thread was written against, for its excerpt once outdated. */
	written?: string;
	/** Who resolved it, and when; unset, it is open. */
	resolved?: { by: string; at: number };
	/** Lines the reviewer proposes in place of the cited ones. */
	suggestion?: string[];
	comments: ThreadCommentSeed[];
}

/** A submitted review. */
export interface ReviewSeed {
	id: string;
	author: string;
	at: number;
	kind: "approve" | "changes" | "comment";
	body?: Block[];
	/** The threads this review opened, by id. */
	threads: string[];
}

/** One check run on the pull request's head. */
export interface CheckSeed {
	name: string;
	workflow: string;
	state: "success" | "failure" | "pending" | "skipped" | "cancelled";
	duration?: string;
}

/** A pull request as the seed writes it; every time counts hours after its last commit. */
export interface PullSeed {
	number: number;
	title: string;
	author: string;
	/** When it opened; negative, before its last commit was pushed. */
	at: number;
	branch: string;
	state: "open" | "merged" | "closed";
	/** When a settled pull request merged or closed, and who did it. */
	settled?: { by: string; at: number };
	draft?: boolean;
	labels: string[];
	assignees: string[];
	/** Reviewers asked who have not reviewed since. */
	requested: string[];
	milestone?: string;
	/** Issues merging it closes. */
	closes?: number[];
	body: Block[];
	/**
	 * Comments and events on the conversation, besides reviews and commits; here each entry's
	 * `ago` counts hours after the last commit.
	 */
	timeline: SeedEntry[];
	reviews: ReviewSeed[];
	threads: ThreadSeed[];
	checks: CheckSeed[];
}

/** The checks every pull request runs, all passing. */
const GREEN: CheckSeed[] = [
	{ name: "check", workflow: "CI / pull_request", state: "success", duration: "1m 48s" },
	{ name: "test (packages)", workflow: "CI / pull_request", state: "success", duration: "2m 51s" },
	{ name: "test (sdxc-site)", workflow: "CI / pull_request", state: "success", duration: "3m 12s" },
	{
		name: "frames (chromium)",
		workflow: "Browser tests / pull_request",
		state: "success",
		duration: "4m 05s",
	},
	{ name: "build", workflow: "CI / pull_request", state: "success", duration: "1m 22s" },
	{ name: "deploy preview", workflow: "Deploy / pull_request", state: "skipped" },
];

/** Every seeded pull request, newest first. */
export const PULLS: readonly PullSeed[] = [
	{
		number: 58,
		title: "Add the issues list, filtered in GitHub's query grammar",
		author: "sergiodxa",
		at: 0.3,
		branch: "issues-list",
		state: "open",
		labels: ["enhancement"],
		assignees: ["sergiodxa"],
		requested: ["ines", "mara"],
		milestone: "v1",
		body: [
			"Adds the Issues tab. The list reads one query in GitHub's grammar (`is:open label:bug author:kenji`), with Author, Labels and Assignees facets beside it and a bulk bar for Close and Assign to me.",
			{
				list: [
					"Filters live in the address, so a filtered list is a link",
					"`j` and `k` walk the rows, `x` selects one",
					"Without script every control is a form or a link",
				],
			},
		],
		timeline: [
			{
				type: "comment",
				id: "c-58-1",
				author: "tlindqvist",
				ago: 1.2,
				body: [
					"Browser tests fail on the bulk bar: the frames job times out waiting for the selection bar after two clicks. It passes locally, so it smells like a slow runner. I'll re-run once the cache warms.",
				],
			},
		],
		reviews: [],
		threads: [],
		checks: [
			...GREEN.filter((check) => check.name !== "frames (chromium)"),
			{
				name: "frames (chromium)",
				workflow: "Browser tests / pull_request",
				state: "failure",
				duration: "6m 00s",
			},
			{ name: "frames (webkit)", workflow: "Browser tests / pull_request", state: "pending" },
		],
	},
	{
		number: 57,
		title: "Show every changed file's diff on a commit",
		author: "sergiodxa",
		at: -1.4,
		branch: "commit-diffs",
		state: "open",
		labels: ["enhancement", "diff"],
		assignees: ["sergiodxa"],
		requested: ["kenji"],
		milestone: "review",
		closes: [48],
		body: [
			"A commit page now shows the diff of every file it touched, read from the patch the build stores, instead of a list of paths.",
			{
				list: [
					"Unified or split, kept in the address as `?diff=split`",
					"Each hunk's expand link widens the context by 20 lines, read from the file as it stood at that commit",
					"Files past 400 changed lines wait behind Load diff and load through a lazy frame",
				],
			},
			"Closes #48: with script, expanding redraws `main` in place without a history entry and keeps the scroll.",
		],
		timeline: [
			{
				type: "comment",
				id: "c-57-1",
				author: "sergiodxa",
				ago: 0.6,
				body: [
					"Thanks both. The threshold stays a constant for now; making it a reader's choice is #49.",
				],
			},
		],
		reviews: [
			{
				id: "r-57-1",
				author: "kenji",
				at: -1.1,
				kind: "comment",
				body: ["Read it against the first push. One structural note on the shell."],
				threads: ["t-57-outdated"],
			},
			{
				id: "r-57-2",
				author: "kenji",
				at: 0.2,
				kind: "comment",
				threads: ["t-57-history"],
			},
			{
				id: "r-57-3",
				author: "mara",
				at: 0.4,
				kind: "approve",
				body: ["Reads well at 375 and in dark mode. Two small things inline, neither blocking."],
				threads: ["t-57-large", "t-57-wrap"],
			},
		],
		threads: [
			{
				id: "t-57-outdated",
				path: "shell.tsx",
				match:
					'export type ShellSection = "dashboard" | "notifications" | "repo" | "org" | "none";',
				written: ADDED,
				resolved: { by: "sergiodxa", at: -0.9 },
				comments: [
					{
						id: "tc-57-1",
						author: "kenji",
						at: -1.1,
						body: [
							"A union here means every new screen edits the shell twice. Could the sections come from the nav array itself?",
						],
					},
					{
						id: "tc-57-2",
						author: "sergiodxa",
						at: -0.9,
						body: [
							"Done in the next push: the nav is one array and `ShellSection` is a plain string.",
						],
					},
				],
			},
			{
				id: "t-57-history",
				path: "diff-island.tsx",
				match: 'link.setAttribute("data-rmx-history", "replace");',
				resolved: { by: "sergiodxa", at: 0.3 },
				comments: [
					{
						id: "tc-57-3",
						author: "kenji",
						at: 0.2,
						body: [
							"Replace rather than push: good, ten presses of expand shouldn't take ten presses of Back.",
						],
					},
					{
						id: "tc-57-4",
						author: "sergiodxa",
						at: 0.3,
						body: ["That was the idea. Resolving."],
					},
				],
			},
			{
				id: "t-57-large",
				path: "diffs.tsx",
				match: "export const LARGE_DIFF = 400;",
				comments: [
					{
						id: "tc-57-5",
						author: "mara",
						at: 0.4,
						body: [
							"Is 400 a guess? GitHub's own cut-off is closer to 500 lines, and our rows are shorter.",
						],
					},
				],
			},
			{
				id: "t-57-wrap",
				path: "screens/commits.tsx",
				match: '<span mix={[raw({ minInlineSize: 0, overflowWrap: "anywhere" })]}>',
				suggestion: [
					'						<span mix={[raw({ minInlineSize: 0, overflowWrap: "break-word" })]}>',
				],
				comments: [
					{
						id: "tc-57-6",
						author: "mara",
						at: 0.45,
						body: [
							"`anywhere` lets a long name break mid-word even where a space would do. `break-word` keeps words whole until one can't fit.",
						],
					},
				],
			},
		],
		checks: GREEN,
	},
	{
		number: 56,
		title: "Add Delta, a code host that browses its own source",
		author: "sergiodxa",
		at: -6,
		branch: "delta",
		state: "merged",
		settled: { by: "sergiodxa", at: 0.5 },
		labels: ["enhancement"],
		assignees: ["sergiodxa"],
		requested: [],
		milestone: "v1",
		body: [
			"The seventh demo: `sdxc/delta` hosting its own source. Files, blame and commits are baked from git when the site builds, so every line here is real.",
		],
		timeline: [],
		reviews: [
			{
				id: "r-56-1",
				author: "mara",
				at: 0.2,
				kind: "approve",
				body: ["Ship it. The brass reads well on both themes."],
				threads: [],
			},
		],
		threads: [],
		checks: GREEN,
	},
	{
		number: 55,
		title: "Add Actions, with run summaries and a live job log",
		author: "tlindqvist",
		at: -2,
		branch: "actions",
		state: "merged",
		settled: { by: "sergiodxa", at: 1 },
		labels: ["enhancement"],
		assignees: ["tlindqvist"],
		requested: [],
		milestone: "v1",
		body: [
			"Adds the Actions tab: the runs list with auto-refresh, a run's summary and job graph, and a job's log that streams while it runs.",
		],
		timeline: [],
		reviews: [{ id: "r-55-1", author: "sergiodxa", at: 0.6, kind: "approve", threads: [] }],
		threads: [],
		checks: GREEN,
	},
];

/** Finds a pull request's seed by number. */
export function findPullSeed(number: number): PullSeed | undefined {
	return PULLS.find((pull) => pull.number === number);
}
