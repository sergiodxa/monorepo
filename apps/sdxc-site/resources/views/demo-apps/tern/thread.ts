/**
 * A conversation as one page shows it: a saved conversation (or none, for a new chat) cut
 * after some of its turns, plus the messages sent on top of it since. The demo keeps nothing,
 * so every form on the page carries this state back in one hidden field.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import type { Conversation, ModelId, Turn } from "~/resources/views/demo-apps/tern/data";

import {
	CANNED_ACTIVITY,
	CANNED_REPLIES,
	DEFAULT_MODEL,
	findModel,
	replyTopic,
	titleFrom,
} from "~/resources/views/demo-apps/tern/data";

/** The hidden field every form on a conversation carries its state in. */
export const THREAD_FIELD = "thread";

/** Longest message a send keeps, so the field stays a reasonable size. */
const MAX_PROMPT = 4000;

/** Most messages a page sends on top of a conversation before the oldest drop off. */
const MAX_ASKS = 8;

/** One message sent from the page and which of its two canned replies answers it. */
export interface Ask {
	prompt: string;
	files: string[];
	variant: 0 | 1;
	/** The model it was sent to. */
	model: ModelId;
}

/** What a page shows. */
export interface Thread {
	/** The saved conversation underneath, or `null` for a new chat. */
	base: Conversation | null;
	/** How many of its turns stay. */
	keep: number;
	asks: Ask[];
	model: ModelId;
}

/** The shape the hidden field parses to; anything else starts the conversation over. */
const STATE = s.object({
	keep: s.number(),
	asks: s.array(
		s.object({
			prompt: s.string(),
			files: s.array(s.string()),
			variant: s.number(),
			model: s.string(),
		}),
	),
});

/**
 * The page a conversation shows when nothing has been sent on it yet.
 *
 * @param base The saved conversation, or `null` for a new chat.
 * @param model The model the address picked.
 * @returns The thread with every saved turn and no sends.
 */
export function savedThread(base: Conversation | null, model: string | null): Thread {
	let lastModel = [...(base?.turns ?? [])].reverse().find((turn) => turn.role === "assistant");
	let fallback = lastModel?.role === "assistant" ? lastModel.model : DEFAULT_MODEL;
	return {
		base,
		keep: base?.turns.length ?? 0,
		asks: [],
		model: model === null ? fallback : findModel(model).id,
	};
}

/**
 * Reads the state a form carried back. A missing or unreadable field is the saved
 * conversation as it is, and the values are clamped, so a post can only shorten the
 * conversation or add the canned replies.
 *
 * @param base The saved conversation the form posted on, or `null`.
 * @param value The field's value.
 * @param model The model field's value.
 * @returns The thread the form was submitted from.
 */
export function readThread(
	base: Conversation | null,
	value: FormDataEntryValue | null,
	model: FormDataEntryValue | null,
): Thread {
	let thread = savedThread(base, typeof model === "string" ? model : null);
	if (typeof value !== "string") return thread;
	let parsed = s.parseSafe(STATE, safeJson(value));
	if (!parsed.success) return thread;
	let { keep, asks } = parsed.value;
	return {
		...thread,
		keep: Math.max(0, Math.min(thread.keep, Math.floor(keep))),
		asks: asks.slice(-MAX_ASKS).map((ask) => ({
			prompt: ask.prompt.slice(0, MAX_PROMPT),
			files: ask.files.slice(0, 5).map((file) => file.slice(0, 120)),
			variant: ask.variant === 1 ? 1 : 0,
			model: findModel(ask.model).id,
		})),
	};
}

/** Parses JSON, answering `null` for anything malformed. */
function safeJson(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

/**
 * Serialises a thread for its forms' hidden field.
 *
 * @param thread The thread the page shows.
 * @returns The field's value.
 */
export function writeThread(thread: Thread): string {
	return JSON.stringify({ keep: thread.keep, asks: thread.asks });
}

/**
 * Adds a sent message to the end of the thread.
 *
 * @param thread The thread it was sent on.
 * @param prompt What was typed.
 * @param files The names of the files attached.
 * @returns The longer thread.
 */
export function send(thread: Thread, prompt: string, files: string[]): Thread {
	let ask: Ask = {
		prompt: prompt.trim().slice(0, MAX_PROMPT),
		files: files.slice(0, 5),
		variant: 0,
		model: thread.model,
	};
	return { ...thread, asks: [...thread.asks, ask].slice(-MAX_ASKS) };
}

/**
 * Answers the user turn at `index` again with its other canned reply, dropping every turn
 * after it. A saved reply is replaced by the topic's alternative.
 *
 * @param thread The thread on the page.
 * @param index The assistant turn's position in {@link turnsOf}.
 * @returns The new thread, or `null` when `index` names no assistant turn.
 */
export function regenerate(thread: Thread, index: number): Thread | null {
	let turns = turnsOf(thread);
	let user = turns[index - 1];
	if (turns[index]?.role !== "assistant" || user?.role !== "user") return null;
	if (index < thread.keep) {
		let ask: Ask = {
			prompt: user.text,
			files: user.files?.map((file) => file.name) ?? [],
			variant: 1,
			model: thread.model,
		};
		return { ...thread, keep: index - 1, asks: [ask] };
	}
	let at = (index - thread.keep - 1) / 2;
	let asks = thread.asks
		.slice(0, at + 1)
		.map((ask, position) =>
			position === at
				? { ...ask, variant: ask.variant === 0 ? (1 as const) : (0 as const), model: thread.model }
				: ask,
		);
	return { ...thread, asks };
}

/**
 * Replaces the user turn at `index` with new text and answers it again, dropping every turn
 * after it.
 *
 * @param thread The thread on the page.
 * @param index The user turn's position in {@link turnsOf}.
 * @param prompt The edited message.
 * @returns The new thread, or `null` when `index` names no user turn.
 */
export function edit(thread: Thread, index: number, prompt: string): Thread | null {
	let turns = turnsOf(thread);
	let user = turns[index];
	if (user?.role !== "user" || prompt.trim() === "") return null;
	let files = user.files?.map((file) => file.name) ?? [];
	let ask: Ask = {
		prompt: prompt.trim().slice(0, MAX_PROMPT),
		files,
		variant: 0,
		model: thread.model,
	};
	if (index < thread.keep) return { ...thread, keep: index, asks: [ask] };
	let at = (index - thread.keep) / 2;
	return { ...thread, asks: [...thread.asks.slice(0, at), ask] };
}

/**
 * Every turn the page shows: the saved turns it keeps, then each sent message and its reply.
 *
 * @param thread The thread.
 * @returns The turns in order.
 */
export function turnsOf(thread: Thread): Turn[] {
	let saved = thread.base?.turns.slice(0, thread.keep) ?? [];
	let sent = thread.asks.flatMap((ask): Turn[] => [
		{
			role: "user",
			text: ask.prompt,
			files: ask.files.map((name) => ({ name, detail: "Attached just now" })),
		},
		{
			role: "assistant",
			model: ask.model,
			blocks: CANNED_REPLIES[replyTopic(ask.prompt)][ask.variant],
			activity: CANNED_ACTIVITY[replyTopic(ask.prompt)],
		},
	]);
	return [...saved, ...sent];
}

/**
 * Whether the page shows the saved conversation exactly, so its forms can redirect to a
 * cacheable address instead of answering with the page.
 */
export function isSaved(thread: Thread): boolean {
	return (
		thread.base !== null && thread.asks.length === 0 && thread.keep === thread.base.turns.length
	);
}

/**
 * The thread's title: the saved conversation's, or a new chat's first words.
 *
 * @param thread The thread.
 * @returns The title the header and document show.
 */
export function threadTitle(thread: Thread): string {
	if (thread.base !== null) return thread.base.title;
	return titleFrom(thread.asks[0]?.prompt ?? "");
}

/**
 * The page a thread's forms post to: its saved conversation's, or `chat` for a new one.
 *
 * @param thread The thread.
 * @returns The page path under the app.
 */
export function threadPage(thread: Thread): string {
	return thread.base === null ? "chat" : `c/${thread.base.id}`;
}

/**
 * A short key that changes whenever the thread does, so the composer replays a reply that
 * arrives in place of one with the same position.
 *
 * @param thread The thread.
 * @returns An FNV-1a hash of its state, in base 36.
 */
export function threadKey(thread: Thread): string {
	let hash = 0x811c9dc5;
	for (let char of `${thread.base?.id}|${thread.model}|${writeThread(thread)}`) {
		hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
	}
	return hash.toString(36);
}
