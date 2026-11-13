/**
 * Delta's issues as one visitor sees them: each seed with its times set against the newest
 * commit, the visitor's edits applied over it, and their changes and comments added to its
 * timeline as events and cards. Every issue screen reads issues through here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Block, IssueSeed, SeedEvent } from "./seed/issues";
import type { RecordEdit, VisitorComment, VisitorState } from "./state";

import { ISSUES } from "./seed/issues";
import { ME } from "./seed/people";

/** An hour, the unit seeds count their ages in. */
const HOUR = 60 * 60 * 1000;

/** A comment card on a timeline. */
export interface TimelineComment {
	type: "comment";
	id: string;
	author: string;
	/** ISO 8601. */
	at: string;
	body: Block[];
	/** Written by the visitor in this browser. */
	visitor?: boolean;
}

/** A one-line event on a timeline. */
export type TimelineEvent = { type: "event"; actor: string; at: string } & SeedEvent;

/** One entry of an issue's or pull request's timeline. */
export type TimelineEntry = TimelineComment | TimelineEvent;

/** An issue as one visitor sees it. */
export interface IssueView {
	number: number;
	title: string;
	author: string;
	/** ISO 8601. */
	createdAt: string;
	/** ISO 8601, the newest entry's time. */
	updatedAt: string;
	state: "open" | "closed";
	/** Why a closed issue closed. */
	reason?: "completed" | "not_planned";
	labels: string[];
	assignees: string[];
	milestone?: string;
	body: Block[];
	/** Comments and events after the opening post, oldest first. */
	timeline: TimelineEntry[];
	/** Comments on the conversation, the opening post not counted. */
	comments: number;
	/** When the visitor last edited it, in epoch milliseconds. */
	editedAt?: number;
}

/** The moment seeds count back from: the newest commit, or now on a build without history. */
export function seedBase(newestCommit: string | undefined, now: number): number {
	let time = newestCommit === undefined ? Number.NaN : Date.parse(newestCommit);
	return Number.isFinite(time) ? Math.min(time, now) : now;
}

/** A seed's age as an ISO time. */
function iso(base: number, ago: number): string {
	return new Date(base - ago * HOUR).toISOString();
}

/**
 * The events a visitor's edit adds: every label, assignee and milestone that differs from the
 * seed, and a close or reopen, all at the time of the edit and by the person signed in.
 */
export function editEvents(
	seed: { labels: readonly string[]; assignees: readonly string[]; milestone?: string },
	edit: RecordEdit | undefined,
	state: { from: "open" | "closed"; to: "open" | "closed" },
): TimelineEvent[] {
	if (edit === undefined) return [];
	let at = new Date(edit.at).toISOString();
	let event = (fields: SeedEvent): TimelineEvent => ({ type: "event", actor: ME, at, ...fields });
	let events: TimelineEvent[] = [];
	if (edit.labels) {
		for (let label of edit.labels) {
			if (!seed.labels.includes(label)) events.push(event({ kind: "labeled", label }));
		}
		for (let label of seed.labels) {
			if (!edit.labels.includes(label)) events.push(event({ kind: "unlabeled", label }));
		}
	}
	if (edit.assignees) {
		for (let person of edit.assignees) {
			if (!seed.assignees.includes(person)) events.push(event({ kind: "assigned", person }));
		}
		for (let person of seed.assignees) {
			if (!edit.assignees.includes(person)) events.push(event({ kind: "unassigned", person }));
		}
	}
	if (
		edit.milestone !== undefined &&
		edit.milestone !== null &&
		edit.milestone !== seed.milestone
	) {
		events.push(event({ kind: "milestoned", milestone: edit.milestone }));
	}
	if (state.from !== state.to) {
		events.push(
			event(state.to === "closed" ? { kind: "closed", reason: "completed" } : { kind: "reopened" }),
		);
	}
	return events;
}

/** The visitor's conversation comments on one number, as timeline cards. */
export function visitorComments(
	comments: readonly VisitorComment[],
	number: number,
): TimelineComment[] {
	return comments
		.filter((comment) => comment.number === number && comment.thread === undefined)
		.map((comment) => ({
			type: "comment",
			id: comment.id,
			author: ME,
			at: new Date(comment.at).toISOString(),
			body: comment.body.split(/\n{2,}/),
			visitor: true,
		}));
}

/** The state a seed's own timeline leaves an issue in, and why it closed. */
function seededState(seed: IssueSeed): {
	state: "open" | "closed";
	reason?: "completed" | "not_planned";
} {
	let state: { state: "open" | "closed"; reason?: "completed" | "not_planned" } = { state: "open" };
	for (let entry of seed.timeline) {
		if (entry.type !== "event") continue;
		if (entry.kind === "closed") state = { state: "closed", reason: entry.reason };
		if (entry.kind === "reopened") state = { state: "open" };
	}
	return state;
}

/** Why a closed issue closed: as its seed says, or completed when the visitor closed it. */
function closedReason(
	current: "open" | "closed",
	seeded: { state: "open" | "closed"; reason?: "completed" | "not_planned" },
	edit: RecordEdit | undefined,
): "completed" | "not_planned" | undefined {
	if (current === "open") return undefined;
	if (seeded.state === "closed") return seeded.reason;
	return edit?.state === "closed" ? "completed" : undefined;
}

/** One issue as the visitor sees it. */
function view(seed: IssueSeed, state: VisitorState, base: number): IssueView {
	let edit = state.records.get(seed.number);
	let seeded = seededState(seed);
	let current = edit?.state ?? seeded.state;
	let seedTimeline: TimelineEntry[] = seed.timeline.map((entry) =>
		entry.type === "comment"
			? {
					type: "comment",
					id: entry.id,
					author: entry.author,
					at: iso(base, entry.ago),
					body: entry.body,
				}
			: ({ ...entry, at: iso(base, entry.ago) } as TimelineEvent),
	);
	let timeline = [
		...seedTimeline,
		...editEvents(seed, edit, { from: seeded.state, to: current }),
		...visitorComments(state.comments, seed.number),
	].sort((a, b) => a.at.localeCompare(b.at));
	let createdAt = iso(base, seed.ago);
	return {
		number: seed.number,
		title: seed.title,
		author: seed.author,
		createdAt,
		updatedAt: timeline.at(-1)?.at ?? createdAt,
		state: current,
		reason: closedReason(current, seeded, edit),
		labels: edit?.labels ?? seed.labels,
		assignees: edit?.assignees ?? seed.assignees,
		milestone: edit?.milestone === null ? undefined : (edit?.milestone ?? seed.milestone),
		body: seed.body,
		timeline,
		comments: timeline.filter((entry) => entry.type === "comment").length,
		editedAt: edit?.at,
	};
}

/**
 * Every issue as the visitor sees it, newest first.
 *
 * @param state The visitor's state.
 * @param base The moment seeds count back from.
 */
export function allIssues(state: VisitorState, base: number): IssueView[] {
	return ISSUES.map((seed) => view(seed, state, base));
}

/** One issue as the visitor sees it, or `undefined` for a number no issue has. */
export function findIssue(
	number: number,
	state: VisitorState,
	base: number,
): IssueView | undefined {
	let seed = ISSUES.find((candidate) => candidate.number === number);
	return seed === undefined ? undefined : view(seed, state, base);
}
