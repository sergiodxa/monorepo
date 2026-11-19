/**
 * Parley's conversations as one visitor sees them: the workspace's history with that visitor's
 * messages, edits, deletions, reactions, pins and the live lines they watched arrive folded in,
 * grouped by day and author, with what is unread and where the "New" divider sits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Conversation, FileRef, Person, Reply } from "~/resources/views/demo-apps/parley/data";
import type { SentMessage, VisitorState } from "~/resources/views/demo-apps/parley/state";

import {
	CONVERSATIONS,
	LIVE,
	ME,
	ME_HANDLE,
	answerTo,
	findPerson,
} from "~/resources/views/demo-apps/parley/data";

/** The studio's own clock, which every time and day label reads in. */
export const WORKSPACE_ZONE = "Europe/Lisbon";

/** A minute in milliseconds. */
const MINUTE = 60_000;

/** How far apart two lines from one person can be and still read as one run. */
const GROUP_GAP = 5 * MINUTE;

/** One reaction on a message as the visitor sees it. */
export interface ReactionView {
	emoji: string;
	/** Everyone who reacted, the visitor first when they did. */
	people: Person[];
	mine: boolean;
}

/** One message or thread reply as the visitor sees it. */
export interface Entry {
	id: string;
	author: Person;
	/** Epoch milliseconds. */
	at: number;
	text: string;
	files: FileRef[];
	reactions: ReactionView[];
	/** Replies in its thread, oldest first; always empty on a reply. */
	replies: Entry[];
	pinned: boolean;
	edited: boolean;
	/** Written by the visitor, so they may edit and delete it. */
	mine: boolean;
	/** Names the visitor. */
	mentionsMe: boolean;
	/** The message a reply belongs to. */
	parent?: string;
}

/** A run of entries one person sent in a row. */
export interface Run {
	author: Person;
	entries: Entry[];
}

/** One day of a conversation, its runs split where the "New" divider falls. */
export interface Day {
	/** "Today", "Yesterday" or "Monday, November 16". */
	label: string;
	/** `YYYY-MM-DD` in {@link WORKSPACE_ZONE}. */
	date: string;
	runs: Run[];
	/** The index into `runs` the "New" divider sits before, when it falls on this day. */
	dividerBefore?: number;
}

/** A conversation's unread lines from others, and how many of them name the visitor. */
export interface Unread {
	count: number;
	mentions: number;
}

/** How a file the visitor attached is drawn: by its extension. */
function fileKind(name: string): FileRef["kind"] {
	let extension = name.split(".").at(-1)?.toLowerCase() ?? "";
	if (["png", "jpg", "jpeg", "gif", "webp", "svg", "heic"].includes(extension)) return "image";
	if (extension === "pdf") return "pdf";
	if (["doc", "docx", "md", "txt", "pages"].includes(extension)) return "doc";
	if (["csv", "xls", "xlsx", "numbers"].includes(extension)) return "sheet";
	if (["ts", "tsx", "js", "json", "sql", "css", "html", "swift", "py"].includes(extension))
		return "code";
	return "other";
}

/**
 * Folds the visitor's toggles into a message's reactions: a `true` adds them to that emoji,
 * a `false` takes them off, and an emoji nobody is left on disappears.
 */
function reactionsOf(
	id: string,
	base: Record<string, readonly string[]> | undefined,
	state: VisitorState,
): ReactionView[] {
	let handles = new Map<string, string[]>(
		Object.entries(base ?? {}).map(([emoji, people]) => [emoji, [...people]]),
	);
	for (let [emoji, on] of Object.entries(state.reactions[id] ?? {})) {
		let people = (handles.get(emoji) ?? []).filter((handle) => handle !== ME_HANDLE);
		handles.set(emoji, on ? [ME_HANDLE, ...people] : people);
	}
	return [...handles]
		.filter(([, people]) => people.length > 0)
		.map(([emoji, people]) => ({
			emoji,
			people: people.flatMap((handle) => findPerson(handle) ?? []),
			mine: people.includes(ME_HANDLE),
		}));
}

/** Whether a message's text names the visitor. */
function namesMe(text: string): boolean {
	return new RegExp(`(^|[^\\w])@${ME_HANDLE}\\b`).test(text);
}

/** Builds an entry from its parts, applying the visitor's edit, pin and reactions. */
function entryOf(
	input: {
		id: string;
		author: string;
		at: number;
		text: string;
		files?: readonly FileRef[];
		reactions?: Record<string, readonly string[]>;
		pinned?: boolean;
		edited?: boolean;
		parent?: string;
	},
	state: VisitorState,
): Entry | null {
	let author = findPerson(input.author);
	if (author === undefined || state.deleted.includes(input.id)) return null;
	let edit = state.edits[input.id];
	let text = edit ?? input.text;
	return {
		id: input.id,
		author,
		at: input.at,
		text,
		files: [...(input.files ?? [])],
		reactions: reactionsOf(input.id, input.reactions, state),
		replies: [],
		pinned: state.pins[input.id] ?? input.pinned ?? false,
		edited: input.edited === true || edit !== undefined,
		mine: author.handle === ME_HANDLE,
		mentionsMe: author.handle !== ME_HANDLE && namesMe(text),
		parent: input.parent,
	};
}

/** The id of the teammate's answer to a sent message. */
export function answerId(sent: SentMessage): string {
	return `${sent.id}-a`;
}

/** A sent message as an entry, its files drawn by extension. */
function sentEntry(sent: SentMessage, state: VisitorState): Entry | null {
	return entryOf(
		{
			id: sent.id,
			author: ME_HANDLE,
			at: sent.at,
			text: sent.text,
			files: sent.files?.map((file) => ({ ...file, kind: fileKind(file.name) })),
			parent: sent.parent,
		},
		state,
	);
}

/** The teammate's answer to a sent message, a few seconds after it. */
export function answerEntry(sent: SentMessage, state: VisitorState): Entry | null {
	let answer = answerTo(sent.key, sent.text);
	return entryOf(
		{
			id: answerId(sent),
			author: answer.author,
			at: sent.at + 12_000,
			text: answer.text,
			parent: sent.parent,
		},
		state,
	);
}

/** The id of a live line, by conversation and position. */
export function liveId(key: string, index: number): string {
	return `live-${key.replace(":", "-")}-${index}`;
}

/**
 * One live line as an entry, arriving at `at`.
 *
 * @returns The entry, or `null` when the conversation has no line at that index.
 */
export function liveEntry(
	key: string,
	index: number,
	at: number,
	state: VisitorState,
): Entry | null {
	let line = LIVE[key]?.[index];
	if (line === undefined) return null;
	return entryOf(
		{ id: liveId(key, index), author: line.author, at, text: line.text, reactions: line.reactions },
		state,
	);
}

/** The live lines the visitor has watched arrive in a conversation, at the times they did. */
function liveEntries(key: string, state: VisitorState): Entry[] {
	let seen = state.live[key] ?? [];
	return (LIVE[key] ?? []).slice(0, seen.length).flatMap((line, index) => {
		let entry = entryOf(
			{
				id: liveId(key, index),
				author: line.author,
				at: seen[index] ?? 0,
				text: line.text,
				reactions: line.reactions,
			},
			state,
		);
		return entry === null ? [] : [entry];
	});
}

/** A fixture reply as an entry. */
function replyEntry(reply: Reply, parent: string, now: number, state: VisitorState): Entry | null {
	return entryOf({ ...reply, at: now - reply.ago * MINUTE, parent }, state);
}

/**
 * Every top-level message of a conversation as the visitor sees it, oldest first, each with
 * its thread's replies, the visitor's own sends and the answers they drew included.
 *
 * @param conversation The channel or DM.
 * @param state The visitor's state.
 * @param now The clock every "minutes before now" counts back from.
 */
export function entriesOf(conversation: Conversation, state: VisitorState, now: number): Entry[] {
	let sent = state.sent.filter((message) => message.key === conversation.key);
	let top: Entry[] = [];
	for (let message of conversation.messages) {
		let entry = entryOf({ ...message, at: now - message.ago * MINUTE }, state);
		if (entry === null) continue;
		entry.replies = (message.replies ?? []).flatMap(
			(reply) => replyEntry(reply, message.id, now, state) ?? [],
		);
		top.push(entry);
	}
	top.push(...liveEntries(conversation.key, state));
	for (let message of sent.filter((candidate) => candidate.parent === undefined)) {
		let entry = sentEntry(message, state);
		if (entry !== null) top.push(entry);
		if (message.answered) {
			let answer = answerEntry(message, state);
			if (answer !== null) top.push(answer);
		}
	}
	let byId = new Map(top.map((entry) => [entry.id, entry]));
	for (let message of sent.filter((candidate) => candidate.parent !== undefined)) {
		let parent = byId.get(message.parent ?? "");
		let entry = sentEntry(message, state);
		if (parent === undefined || entry === null) continue;
		parent.replies.push(entry);
		if (message.answered) {
			let answer = answerEntry(message, state);
			if (answer !== null) parent.replies.push(answer);
		}
	}
	for (let entry of top) entry.replies.sort((a, b) => a.at - b.at);
	return top.sort((a, b) => a.at - b.at);
}

/**
 * When the visitor last read a conversation: the time they marked it read, else the history's
 * own marker.
 */
export function readAt(conversation: Conversation, state: VisitorState, now: number): number {
	return state.read[conversation.key] ?? now - conversation.readAgo * MINUTE;
}

/**
 * How many lines from others arrived since the visitor last read, and how many name them.
 *
 * @param conversation The channel or DM.
 * @param state The visitor's state.
 * @param now The clock.
 */
export function unreadOf(conversation: Conversation, state: VisitorState, now: number): Unread {
	let since = readAt(conversation, state, now);
	let unread = entriesOf(conversation, state, now).filter(
		(entry) => !entry.mine && entry.at > since,
	);
	let count = unread.length;
	let mentions = unread.filter((entry) => entry.mentionsMe).length;
	if (conversation.kind === "dm") mentions = count;
	return { count, mentions };
}

/** Every conversation's unread counts, keyed by conversation. */
export function unreadByKey(state: VisitorState, now: number): Record<string, Unread> {
	return Object.fromEntries(
		CONVERSATIONS.map((conversation) => [conversation.key, unreadOf(conversation, state, now)]),
	);
}

/** Formatters in the studio's clock. */
const FORMAT = {
	time: new Intl.DateTimeFormat("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: WORKSPACE_ZONE,
	}),
	date: new Intl.DateTimeFormat("en-CA", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		timeZone: WORKSPACE_ZONE,
	}),
	day: new Intl.DateTimeFormat("en-GB", {
		weekday: "long",
		month: "long",
		day: "numeric",
		timeZone: WORKSPACE_ZONE,
	}),
} as const;

/** The time of day an entry was sent, such as "14:05". */
export function timeOf(at: number): string {
	return FORMAT.time.format(at);
}

/** The calendar date an entry was sent on, in the studio's clock. */
function dateOf(at: number): string {
	return FORMAT.date.format(at);
}

/** A day's heading: "Today", "Yesterday" or the weekday and date. */
export function dayLabel(at: number, now: number): string {
	let date = dateOf(at);
	if (date === dateOf(now)) return "Today";
	if (date === dateOf(now - 24 * 60 * MINUTE)) return "Yesterday";
	return FORMAT.day.format(at);
}

/** A short "when" for search results and thread summaries: a time today, else a day. */
export function whenOf(at: number, now: number): string {
	let label = dayLabel(at, now);
	return label === "Today" ? timeOf(at) : label;
}

/**
 * Splits entries into days and runs: a run ends when the author changes, more than five
 * minutes pass, or the "New" divider falls between two lines.
 *
 * @param entries Top-level entries, oldest first.
 * @param since When the visitor last read; the divider sits before the first later line from
 *   someone else. `undefined` draws no divider.
 * @param now The clock, for the day labels.
 */
export function daysOf(entries: Entry[], since: number | undefined, now: number): Day[] {
	let firstUnread =
		since === undefined ? undefined : entries.find((entry) => !entry.mine && entry.at > since);
	let days: Day[] = [];
	let last: Entry | undefined;
	for (let entry of entries) {
		let date = dateOf(entry.at);
		let day = days.at(-1);
		if (day === undefined || day.date !== date) {
			day = { label: dayLabel(entry.at, now), date, runs: [] };
			days.push(day);
			last = undefined;
		}
		let divides = entry === firstUnread;
		let run = day.runs.at(-1);
		let continues =
			run !== undefined &&
			last !== undefined &&
			!divides &&
			run.author.handle === entry.author.handle &&
			entry.at - last.at <= GROUP_GAP;
		if (divides) day.dividerBefore = day.runs.length;
		if (continues && run !== undefined) run.entries.push(entry);
		else day.runs.push({ author: entry.author, entries: [entry] });
		last = entry;
	}
	return days;
}

/** One search hit: the entry and where it lives. */
export interface Hit {
	entry: Entry;
	conversation: Conversation;
}

/**
 * Finds every message and reply whose text holds the query, newest first, in one
 * conversation or all of them.
 *
 * @param query The words, matched case-insensitively as one phrase.
 * @param key A conversation key to search in, or `undefined` for every conversation.
 * @param state The visitor's state.
 * @param now The clock.
 */
export function search(
	query: string,
	key: string | undefined,
	state: VisitorState,
	now: number,
): Hit[] {
	let needle = query.trim().toLowerCase();
	if (needle === "") return [];
	let hits: Hit[] = [];
	for (let conversation of CONVERSATIONS) {
		if (key !== undefined && conversation.key !== key) continue;
		for (let entry of entriesOf(conversation, state, now)) {
			for (let candidate of [entry, ...entry.replies]) {
				let haystack = `${candidate.text} ${candidate.files.map((file) => file.name).join(" ")}`;
				if (haystack.toLowerCase().includes(needle)) hits.push({ entry: candidate, conversation });
			}
		}
	}
	return hits.sort((a, b) => b.entry.at - a.entry.at);
}

/**
 * Finds a message or reply by id in a conversation.
 *
 * @returns The entry, or `undefined` when no visible one has that id.
 */
export function findEntry(
	conversation: Conversation,
	id: string,
	state: VisitorState,
	now: number,
): Entry | undefined {
	for (let entry of entriesOf(conversation, state, now)) {
		if (entry.id === id) return entry;
		let reply = entry.replies.find((candidate) => candidate.id === id);
		if (reply !== undefined) return reply;
	}
	return undefined;
}

/** The visitor, for components that only need their face. */
export const VISITOR = ME;
