/**
 * What one visitor changed in Cairn, kept in their own cookies: each issue's status, priority
 * and assignee in a cookie of its own, so two quick edits never overwrite each other, and the
 * issues and comments they wrote in one cookie each. Every screen reads issues through here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Change, Comment, Issue, PriorityId, StatusId } from "./data";

import { ISSUES, ME, PEOPLE, PRIORITIES, STATUSES, TEAMS, findProject } from "./data";

/** Every Cairn cookie starts with this, which is how a request is known to be personal. */
export const COOKIE_PREFIX = "cairn.";

/** The cookie holding the issues the visitor created. */
export const CREATED_COOKIE = `${COOKIE_PREFIX}new`;

/** The cookie holding the comments the visitor wrote. */
export const COMMENTS_COOKIE = `${COOKIE_PREFIX}comments`;

/** How many created issues or comments are kept; the oldest goes first. */
const KEPT = 6;

/** The most a list cookie's value may weigh, under a browser's 4 KB per cookie. */
const LIST_COOKIE_BYTES = 3600;

/** A week: long enough to come back to, short enough that the demo resets itself. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** How long after an edit the issue's save status still reads "Saved". */
export const SAVED_WINDOW_MS = 4000;

/** One issue's fields as the visitor last set them, and when, in epoch milliseconds. */
export interface Edit {
	status: StatusId;
	priority: PriorityId;
	assignee?: string;
	at: number;
}

/** An issue the visitor created. */
export interface CreatedIssue {
	id: string;
	team: string;
	title: string;
	description: string;
	status: StatusId;
	priority: PriorityId;
	assignee?: string;
	project?: string;
	at: number;
}

/** A comment the visitor wrote. */
export interface VisitorComment {
	id: string;
	issue: string;
	body: string;
	at: number;
}

/** Everything the visitor changed. */
export interface VisitorState {
	edits: Map<string, Edit>;
	created: CreatedIssue[];
	comments: VisitorComment[];
}

/** An issue as one visitor sees it, with their edits, comments and history applied. */
export interface IssueView extends Issue {
	/** When the visitor last edited it, in epoch milliseconds. */
	editedAt?: number;
	/** Created by the visitor in this browser. */
	fresh: boolean;
}

/** Splits a `Cookie` header into its pairs, keeping only Cairn's. */
function cairnCookies(header: string | null): Map<string, string> {
	let pairs = new Map<string, string>();
	for (let pair of (header ?? "").split(";")) {
		let [name = "", ...value] = pair.trim().split("=");
		if (name.startsWith(COOKIE_PREFIX)) pairs.set(name, value.join("="));
	}
	return pairs;
}

/**
 * Whether a request carries anything the visitor did, so its pages are drawn fresh rather
 * than from a copy cached for everyone.
 *
 * @param header The request's `Cookie` header.
 */
export function isPersonal(header: string | null): boolean {
	return cairnCookies(header).size > 0;
}

/** Narrows a string to a workflow state. */
export function asStatus(value: string): StatusId | undefined {
	return STATUSES.find((status) => status === value);
}

/** Narrows a string to a priority. */
export function asPriority(value: string): PriorityId | undefined {
	return PRIORITIES.find((priority) => String(priority) === value);
}

/** Narrows a string to a person's id, `""` and `"none"` meaning no one. */
export function asAssignee(value: string): string | null | undefined {
	if (value === "" || value === "none") return null;
	return PEOPLE.some((person) => person.id === value) ? value : undefined;
}

/**
 * Reads an edit cookie's value, `status.priority.assignee.seconds`, refusing anything else
 * so a tampered cookie reads as no edit.
 */
function decodeEdit(value: string): Edit | undefined {
	let [status = "", priority = "", assignee = "", seconds = ""] = value.split(".");
	let parsedStatus = asStatus(status);
	let parsedPriority = asPriority(priority);
	let parsedAssignee = asAssignee(assignee === "-" ? "" : assignee);
	let at = Number(seconds) * 1000;
	if (!parsedStatus || parsedPriority === undefined || parsedAssignee === undefined)
		return undefined;
	if (!Number.isFinite(at)) return undefined;
	return {
		status: parsedStatus,
		priority: parsedPriority,
		assignee: parsedAssignee ?? undefined,
		at,
	};
}

/** Decodes base64url without padding. */
function fromBase64Url(value: string): Uint8Array {
	let base64 = value.replaceAll("-", "+").replaceAll("_", "/");
	return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/** Encodes bytes as base64url without padding, so the value needs no cookie quoting. */
function toBase64Url(bytes: Uint8Array): string {
	let binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** Reads a list cookie as an array of records, or none when it is unreadable. */
function decodeList(value: string | undefined): Array<Record<string, unknown>> {
	if (!value) return [];
	try {
		let parsed: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(value)));
		return Array.isArray(parsed)
			? parsed.filter(
					(entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null,
				)
			: [];
	} catch {
		return [];
	}
}

/** Reads a created issue's short-keyed record, checking each field. */
function decodeCreated(entry: Record<string, unknown>): CreatedIssue[] {
	let { i, m, t, d, s, p, a, j, at } = entry;
	if (typeof i !== "string" || typeof m !== "string" || typeof t !== "string") return [];
	if (typeof at !== "number" || !TEAMS.some((team) => team.id === m)) return [];
	let status = asStatus(String(s));
	let priority = asPriority(String(p));
	if (!status || priority === undefined) return [];
	return [
		{
			id: i,
			team: m,
			title: t.slice(0, 120),
			description: typeof d === "string" ? d.slice(0, 600) : "",
			status,
			priority,
			assignee: typeof a === "string" && asAssignee(a) ? a : undefined,
			project: typeof j === "string" && findProject(j) ? j : undefined,
			at,
		},
	];
}

/** Reads a comment's short-keyed record, checking each field. */
function decodeComment(entry: Record<string, unknown>): VisitorComment[] {
	let { i, s, b, at } = entry;
	if (typeof i !== "string" || typeof s !== "string" || typeof b !== "string") return [];
	if (typeof at !== "number") return [];
	return [{ id: i, issue: s, body: b.slice(0, 600), at }];
}

/**
 * Reads the visitor's state from the request's `Cookie` header.
 *
 * @param header The request's `Cookie` header.
 */
export function readState(header: string | null): VisitorState {
	let cookies = cairnCookies(header);
	let edits = new Map<string, Edit>();
	for (let [name, value] of cookies) {
		if (!name.startsWith(`${COOKIE_PREFIX}i.`)) continue;
		let edit = decodeEdit(value);
		if (edit) edits.set(name.slice(`${COOKIE_PREFIX}i.`.length), edit);
	}
	return {
		edits,
		created: decodeList(cookies.get(CREATED_COOKIE)).flatMap(decodeCreated),
		comments: decodeList(cookies.get(COMMENTS_COOKIE)).flatMap(decodeComment),
	};
}

/** Builds a `Set-Cookie` value scoped to the demos, so the app's pages and frames both read it. */
function cookieHeader(name: string, value: string | null): string {
	let age = value === null ? 0 : COOKIE_MAX_AGE;
	return `${name}=${value ?? ""}; Path=/demo; Max-Age=${age}; SameSite=Lax; HttpOnly`;
}

/**
 * The cookie recording an issue's fields after an edit.
 *
 * @param id The issue's id.
 * @param edit Its status, priority and assignee now, and when.
 */
export function editCookie(id: string, edit: Edit): string {
	let value = [edit.status, edit.priority, edit.assignee ?? "-", Math.floor(edit.at / 1000)].join(
		".",
	);
	return cookieHeader(`${COOKIE_PREFIX}i.${id}`, value);
}

/** Encodes the newest records that fit one cookie, dropping the oldest first. */
function keepNewest(records: Array<Record<string, unknown>>): string {
	let kept = records.slice(-KEPT);
	let encode = (list: typeof kept) => toBase64Url(new TextEncoder().encode(JSON.stringify(list)));
	let value = encode(kept);
	while (value.length > LIST_COOKIE_BYTES && kept.length > 1) {
		kept = kept.slice(1);
		value = encode(kept);
	}
	return value;
}

/** The created-issues cookie after adding one. */
export function createdCookie(state: VisitorState, issue: CreatedIssue): string {
	let records = [...state.created, issue].map((entry) => ({
		i: entry.id,
		m: entry.team,
		t: entry.title,
		d: entry.description,
		s: entry.status,
		p: entry.priority,
		a: entry.assignee,
		j: entry.project,
		at: entry.at,
	}));
	return cookieHeader(CREATED_COOKIE, keepNewest(records));
}

/** The comments cookie after adding one. */
export function commentsCookie(state: VisitorState, comment: VisitorComment): string {
	let records = [...state.comments, comment].map((entry) => ({
		i: entry.id,
		s: entry.issue,
		b: entry.body,
		at: entry.at,
	}));
	return cookieHeader(COMMENTS_COOKIE, keepNewest(records));
}

/**
 * Clears every Cairn cookie a request carries, which resets the demo.
 *
 * @param header The request's `Cookie` header.
 */
export function clearCookies(header: string | null): string[] {
	return [...cairnCookies(header).keys()].map((name) => cookieHeader(name, null));
}

/** The next free number for a team's new issue, past the fixtures and the visitor's own. */
export function nextIssueId(state: VisitorState, teamId: string): string {
	let team = TEAMS.find((candidate) => candidate.id === teamId);
	let key = team?.key ?? "WEB";
	let numbers = [...ISSUES, ...state.created]
		.filter((issue) => issue.id.startsWith(`${key}-`))
		.map((issue) => Number(issue.id.slice(key.length + 1)));
	return `${key}-${Math.max(0, ...numbers) + 1}`;
}

/** A created issue as an issue, written by the signed-in person. */
function fromCreated(created: CreatedIssue): Issue {
	let at = new Date(created.at).toISOString();
	return {
		id: created.id,
		team: created.team,
		title: created.title,
		status: created.status,
		priority: created.priority,
		assignee: created.assignee,
		labels: [],
		project: created.project,
		description: created.description === "" ? [] : created.description.split(/\n{2,}/),
		createdBy: ME,
		createdAt: at,
		updatedAt: at,
	};
}

/**
 * One issue as the visitor sees it: their edit applied over the fixture, the change added to
 * its history, and their comments appended.
 */
function view(issue: Issue, state: VisitorState, fresh: boolean): IssueView {
	let edit = state.edits.get(issue.id);
	let comments: Comment[] = [
		...(issue.comments ?? []),
		...state.comments
			.filter((comment) => comment.issue === issue.id)
			.map((comment) => ({
				id: comment.id,
				author: ME,
				at: new Date(comment.at).toISOString(),
				body: comment.body,
			})),
	];
	if (!edit) return { ...issue, comments, fresh };
	let at = new Date(edit.at).toISOString();
	let changes: Change[] = [...(issue.changes ?? [])];
	if (edit.status !== issue.status)
		changes.push({ at, actor: ME, field: "status", to: edit.status });
	if (edit.priority !== issue.priority) {
		changes.push({ at, actor: ME, field: "priority", to: String(edit.priority) });
	}
	if (edit.assignee !== issue.assignee) {
		changes.push({ at, actor: ME, field: "assignee", to: edit.assignee });
	}
	return {
		...issue,
		status: edit.status,
		priority: edit.priority,
		assignee: edit.assignee,
		updatedAt: at > issue.updatedAt ? at : issue.updatedAt,
		changes,
		comments,
		editedAt: edit.at,
		fresh,
	};
}

/**
 * Every issue as the visitor sees it: the fixtures with their edits, then the issues they
 * created, newest last.
 *
 * @param state The visitor's state.
 */
export function allIssues(state: VisitorState): IssueView[] {
	return [
		...ISSUES.map((issue) => view(issue, state, false)),
		...state.created.map((created) => view(fromCreated(created), state, true)),
	];
}

/**
 * Finds one issue as the visitor sees it.
 *
 * @param id The issue's id.
 * @param state The visitor's state.
 */
export function findIssue(id: string, state: VisitorState): IssueView | undefined {
	return allIssues(state).find((issue) => issue.id === id);
}

/** The fields an edit starts from: the visitor's last edit, else the issue as it is. */
export function currentFields(issue: IssueView): Omit<Edit, "at"> {
	return { status: issue.status, priority: issue.priority, assignee: issue.assignee };
}
