/**
 * Delta's pull requests as one visitor sees them: each seed set against its real commit range,
 * its threads placed by content in that range's diff (or marked outdated with the code they
 * were written on), and the visitor's reviews, replies, resolves and merge applied over it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Hunk } from "@sdxc/diff";

import { diffLines } from "@sdxc/diff";

import type { DeltaCommit } from "~/app/services/delta/source";

import { excerptHunk, findInHunks } from "~/app/services/delta/hunks";
import { fileHunks, readHistory, rangeHunks, readRange } from "~/app/services/delta/source";

import type { TimelineEntry } from "./records";
import type { Block } from "./seed/issues";
import type { CheckSeed, PullSeed, ThreadSeed } from "./seed/pulls";
import type { LineComment, MergeMethod, ReviewKind, VisitorState } from "./state";

import { editEvents, seedBase, visitorComments } from "./records";
import { ME, personByName } from "./seed/people";
import { PULLS } from "./seed/pulls";

/** An hour, the unit seeds count their times in. */
const HOUR = 60 * 60 * 1000;

/** One comment of a review thread. */
export interface ThreadComment {
	id: string;
	author: string;
	at: string;
	body: Block[];
	/** Part of a review the visitor hasn't submitted. */
	pending?: boolean;
}

/** A review thread as the page draws it. */
export interface ThreadView {
	id: string;
	path: string;
	side: "L" | "R";
	/** The lines it cites on that side; unknown for an outdated thread with no excerpt. */
	start?: number;
	end?: number;
	/** The cited lines changed since it was written, so it sits off the diff. */
	outdated: boolean;
	/** The code it is about: the lines from the diff, or as they were once outdated. */
	excerpt?: Hunk;
	suggestion?: Hunk[];
	resolved: boolean;
	resolvedBy?: string;
	comments: ThreadComment[];
	/** The visitor wrote it in this browser. */
	visitor?: boolean;
	/** Every comment in it is pending, part of an unsubmitted review. */
	pending?: boolean;
}

/** A submitted review. */
export interface ReviewView {
	id: string;
	author: string;
	at: string;
	kind: ReviewKind;
	body: Block[];
	threads: string[];
}

/** One entry of a pull request's conversation. */
export type PullEntry =
	| TimelineEntry
	| { type: "commits"; at: string; actor: string; commits: DeltaCommit[] }
	| { type: "review"; at: string; review: ReviewView }
	| { type: "merged"; at: string; actor: string; sha: string; method: MergeMethod };

/** A reviewer and where their review stands. */
export interface Reviewer {
	handle: string;
	state: "approved" | "changes" | "commented" | "requested";
}

/** A pull request as one visitor sees it. */
export interface PullView {
	number: number;
	title: string;
	author: string;
	branch: string;
	createdAt: string;
	updatedAt: string;
	state: "open" | "merged" | "closed";
	draft: boolean;
	/** Who merged or closed it, and when. */
	settled?: { by: string; at: string; method?: MergeMethod };
	labels: string[];
	assignees: string[];
	reviewers: Reviewer[];
	milestone?: string;
	closes: number[];
	body: Block[];
	/** The range resolved: its commits, oldest first, and the head the diff ends at. */
	commits: DeltaCommit[];
	head?: string;
	/** The range's files and their counts. */
	files: number;
	additions: number;
	deletions: number;
	reviews: ReviewView[];
	threads: ThreadView[];
	timeline: PullEntry[];
	checks: CheckSeed[];
	/** Paths the visitor marked viewed. */
	viewed: string[];
	/** Review comments the visitor hasn't submitted. */
	pending: LineComment[];
	/** Comments on the conversation, the opening post not counted. */
	comments: number;
	editedAt?: number;
}

/** Hours after a moment, as an ISO time. */
function after(start: number, hours: number): string {
	return new Date(start + hours * HOUR).toISOString();
}

/**
 * Places a seeded thread: on the line of the range's diff whose new side contains its match,
 * or, when no line does, outdated, with the lines it quoted from the commit it was written on.
 */
async function placeThread(
	pull: number,
	seed: ThreadSeed,
	commits: readonly DeltaCommit[],
): Promise<Pick<ThreadView, "side" | "start" | "end" | "outdated" | "excerpt">> {
	let hunks = (await rangeHunks(pull, seed.path)) ?? [];
	let found = findInHunks(hunks, seed.match, seed.span);
	if (found !== undefined) {
		return {
			side: "R",
			start: found.start,
			end: found.end,
			outdated: false,
			excerpt: excerptHunk(hunks, "R", found.end),
		};
	}
	let history = await readHistory();
	let written = [...commits, ...history.commits].find((commit) => commit.subject === seed.written);
	let old = written === undefined ? undefined : await fileHunks(written.sha, seed.path);
	let then = old === undefined ? undefined : findInHunks(old, seed.match, seed.span);
	return {
		side: "R",
		start: then?.start,
		end: then?.end,
		outdated: true,
		excerpt: then === undefined || old === undefined ? undefined : excerptHunk(old, "R", then.end),
	};
}

/** A suggestion as a small diff from the cited lines to the proposed ones. */
function suggestionHunks(
	excerpt: Hunk | undefined,
	end: number | undefined,
	lines: string[],
): Hunk[] {
	let cited =
		excerpt?.lines
			.filter((line) => line.kind !== "del" && line.new === end)
			.map((line) => line.text) ?? [];
	let start = end ?? 1;
	let hunks = diffLines(`${cited.join("\n")}\n`, `${lines.join("\n")}\n`).hunks;
	return hunks.map((hunk) => ({
		...hunk,
		oldStart: hunk.oldStart + start - 1,
		newStart: hunk.newStart + start - 1,
		lines: hunk.lines.map((line) => ({
			...line,
			old: line.old === undefined ? undefined : line.old + start - 1,
			new: line.new === undefined ? undefined : line.new + start - 1,
		})),
	}));
}

/** A visitor's line comment as a thread of its own, pending or posted. */
function visitorThread(
	comment: LineComment,
	pending: boolean,
	hunks: Hunk[] | undefined,
): ThreadView {
	return {
		id: comment.id,
		path: comment.path,
		side: comment.side,
		start: comment.start,
		end: comment.end,
		outdated: false,
		excerpt: hunks === undefined ? undefined : excerptHunk(hunks, comment.side, comment.end),
		resolved: false,
		comments: [
			{
				id: `${comment.id}-0`,
				author: ME,
				at: new Date(comment.at).toISOString(),
				body: comment.body.split(/\n{2,}/),
				pending,
			},
		],
		visitor: true,
		pending,
	};
}

/** The state each kind of review leaves its reviewer in. */
const REVIEW_STATES: Record<ReviewKind, Reviewer["state"]> = {
	approve: "approved",
	changes: "changes",
	comment: "commented",
};

/** Where each reviewer stands: their latest review, or requested and waiting. */
function reviewersOf(seed: PullSeed, reviews: ReviewView[], requested: string[]): Reviewer[] {
	let latest = new Map<string, Reviewer["state"]>();
	for (let review of reviews) {
		if (review.author === seed.author) continue;
		let state = REVIEW_STATES[review.kind];
		let current = latest.get(review.author);
		if (current !== "approved" && current !== "changes") latest.set(review.author, state);
		else if (state !== "commented") latest.set(review.author, state);
	}
	for (let handle of requested) latest.set(handle, "requested");
	return [...latest].map(([handle, state]) => ({ handle, state }));
}

/** Who resolved a thread: the visitor when they did, else the seed's resolver. */
function resolver(
	resolved: boolean,
	override: boolean | undefined,
	thread: ThreadSeed,
): string | undefined {
	if (!resolved) return undefined;
	return override === true ? ME : thread.resolved?.by;
}

/** Who merged or closed a pull request and when: the visitor's merge, else the seed's. */
function settledBy(
	seed: PullSeed,
	merged: { at: number; method: MergeMethod } | undefined,
	start: number,
): PullView["settled"] {
	if (merged !== undefined) {
		return { by: ME, at: new Date(merged.at).toISOString(), method: merged.method };
	}
	if (seed.settled === undefined) return undefined;
	return { by: seed.settled.by, at: after(start, seed.settled.at), method: "merge" };
}

/** One pull request as the visitor sees it. */
async function view(seed: PullSeed, state: VisitorState, now: number): Promise<PullView> {
	let [range, history] = await Promise.all([readRange(seed.number), readHistory()]);
	let resolved = range?.status === "resolved" ? range : undefined;
	let commits = (resolved?.commits ?? []).flatMap(
		(sha) => history.commits.find((commit) => commit.sha === sha) ?? [],
	);
	let headDate = commits.at(-1)?.date;
	let start = seedBase(headDate ?? history.commits[0]?.date, now);
	let edit = state.records.get(seed.number);

	let reviews: ReviewView[] = seed.reviews.map((review) => ({
		id: review.id,
		author: review.author,
		at: after(start, review.at),
		kind: review.kind,
		body: review.body ?? [],
		threads: review.threads,
	}));
	let threads: ThreadView[] = await Promise.all(
		seed.threads.map(async (thread) => {
			let placed = await placeThread(seed.number, thread, commits);
			let override = edit?.resolved?.[thread.id];
			let isResolved = override ?? thread.resolved !== undefined;
			let replies = state.comments
				.filter((comment) => comment.number === seed.number && comment.thread === thread.id)
				.map((comment) => ({
					id: comment.id,
					author: ME,
					at: new Date(comment.at).toISOString(),
					body: comment.body.split(/\n{2,}/),
				}));
			return {
				id: thread.id,
				path: thread.path,
				...placed,
				suggestion:
					thread.suggestion === undefined || placed.outdated
						? undefined
						: suggestionHunks(placed.excerpt, placed.end, thread.suggestion),
				resolved: isResolved,
				resolvedBy: resolver(isResolved, override, thread),
				comments: [
					...thread.comments.map((comment) => ({
						id: comment.id,
						author: comment.author,
						at: after(start, comment.at),
						body: comment.body,
					})),
					...replies,
				],
			};
		}),
	);
	for (let comment of edit?.posted ?? []) {
		let hunks = await rangeHunks(seed.number, comment.path);
		threads.push(visitorThread(comment, false, hunks));
	}
	for (let comment of edit?.pending ?? []) {
		let hunks = await rangeHunks(seed.number, comment.path);
		threads.push(visitorThread(comment, true, hunks));
	}
	if (edit?.review) {
		reviews.push({
			id: "r-visitor",
			author: ME,
			at: new Date(edit.review.at).toISOString(),
			kind: edit.review.kind,
			body: edit.review.body === "" ? [] : edit.review.body.split(/\n{2,}/),
			threads: (edit.posted ?? []).map((comment) => comment.id),
		});
	}

	let merged = edit?.merged;
	let current: PullView["state"] = merged ? "merged" : seed.state;
	let settled = settledBy(seed, merged, start);
	let createdAt = after(start, seed.at);
	let entries: PullEntry[] = [
		...seed.timeline.map((entry): PullEntry =>
			entry.type === "comment"
				? {
						type: "comment",
						id: entry.id,
						author: entry.author,
						at: after(start, entry.ago),
						body: entry.body,
					}
				: ({ ...entry, at: after(start, entry.ago) } as TimelineEntry),
		),
		...editEvents(seed, edit, { from: "open", to: "open" }),
		...visitorComments(state.comments, seed.number),
		...reviews.map((review): PullEntry => ({ type: "review", at: review.at, review })),
		...groupPushes(commits),
	];
	if (settled !== undefined && current === "merged") {
		entries.push({
			type: "merged",
			at: settled.at,
			actor: settled.by,
			sha: resolved?.head ?? "",
			method: settled.method ?? "merge",
		});
	}
	if (current === "closed" && settled !== undefined) {
		entries.push({
			type: "event",
			actor: settled.by,
			at: settled.at,
			kind: "closed",
			reason: "not_planned",
		} as PullEntry);
	}
	entries.sort((a, b) => a.at.localeCompare(b.at));
	let requested = edit?.reviewers ?? seed.requested;
	let files = resolved?.files ?? [];
	return {
		number: seed.number,
		title: seed.title,
		author: seed.author,
		branch: seed.branch,
		createdAt,
		updatedAt: entries.at(-1)?.at ?? createdAt,
		state: current,
		draft: seed.draft === true,
		settled,
		labels: edit?.labels ?? seed.labels,
		assignees: edit?.assignees ?? seed.assignees,
		reviewers: reviewersOf(seed, reviews, requested),
		milestone: edit?.milestone === null ? undefined : (edit?.milestone ?? seed.milestone),
		closes: seed.closes ?? [],
		body: seed.body,
		commits,
		head: resolved?.head,
		files: files.length,
		additions: files.reduce((sum, file) => sum + (file.additions ?? 0), 0),
		deletions: files.reduce((sum, file) => sum + (file.deletions ?? 0), 0),
		reviews,
		threads,
		timeline: entries,
		checks: seed.checks,
		viewed: edit?.viewed ?? [],
		pending: edit?.pending ?? [],
		comments: entries.filter((entry) => entry.type === "comment").length,
		editedAt: edit?.at,
	};
}

/** Groups a range's commits into pushes, one per author and day, as a timeline shows them. */
function groupPushes(commits: readonly DeltaCommit[]): PullEntry[] {
	let groups: Array<{ type: "commits"; at: string; actor: string; commits: DeltaCommit[] }> = [];
	for (let commit of commits) {
		let last = groups.at(-1);
		if (last !== undefined && last.commits.at(-1)?.date.slice(0, 10) === commit.date.slice(0, 10)) {
			last.commits.push(commit);
		} else {
			groups.push({
				type: "commits",
				at: new Date(commit.date).toISOString(),
				actor: personByName(commit.author)?.handle ?? commit.author,
				commits: [commit],
			});
		}
	}
	return groups;
}

/** Every pull request as the visitor sees it, newest first. */
export function allPulls(state: VisitorState, now: number): Promise<PullView[]> {
	return Promise.all(PULLS.map((seed) => view(seed, state, now)));
}

/** One pull request as the visitor sees it, or `undefined` for a number none has. */
export async function findPull(
	number: number,
	state: VisitorState,
	now: number,
): Promise<PullView | undefined> {
	let seed = PULLS.find((candidate) => candidate.number === number);
	return seed === undefined ? undefined : view(seed, state, now);
}

/** Where the checks stand, worst first. */
export function checksState(checks: readonly CheckSeed[]): "failure" | "pending" | "success" {
	if (checks.some((check) => check.state === "failure")) return "failure";
	if (checks.some((check) => check.state === "pending")) return "pending";
	return "success";
}
