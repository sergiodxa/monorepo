/**
 * The novel's typed events and the listener registry behind `novel.on()`. Listeners run side
 * effects only: the engine emits after a stop is settled, and a listener that throws or rejects
 * is reported on `error` instead of reaching the play, so the story stays deterministic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ChapterInfo } from "./declarations.js";
import type { Ending, GameState } from "./frames.js";
import type { Novel, Play } from "./novel.js";
import type { NovelPersistent } from "./types.js";

import { NovelError } from "./errors.js";

/** A scene started from its top, by a new play, a `goto` or a `call`. */
export interface SceneEvent {
	scene: string;
}

/** A line was shown, with the values it was shown with. */
export interface LineEvent {
	scene: string;
	key: string;
	/** The ids of the characters saying it; empty for narration. */
	speakers: string[];
	values: Record<string, unknown> | undefined;
}

/**
 * The play passed a `notify`, with the values it was passed with. A rollback or a load that
 * lands past it does not send it again, and a replay never sends it.
 */
export interface NotifyEvent {
	scene: string;
	/** The notification's message key, which the app translates with `values`. */
	key: string;
	values: Record<string, unknown> | undefined;
}

/** The player took an option, and the engine accepted it. */
export interface ChoiceEvent {
	scene: string;
	/** The option's label key. */
	option: string;
}

/** An image was shown or a track played for the first time in any playthrough. */
export interface UnlockEvent {
	kind: "image" | "music" | "entry";
	/** The asset's id (`images.letter`), or the entry's (`places.hogsmeade`). */
	id: string;
}

/** The play entered a scene of another chapter than the one it was in. */
export interface ChapterEvent {
	chapter: ChapterInfo;
	/** The scene the chapter was entered through. */
	scene: string;
}

/** The app asked to save the play into a slot. */
export interface SaveEvent {
	slot: string;
	/** The play as JSON, for the app to store. */
	state: GameState;
}

/** Every event a novel emits, by name, with the payload its listeners receive. */
export interface NovelEvents {
	scene: SceneEvent;
	line: LineEvent;
	notify: NotifyEvent;
	choice: ChoiceEvent;
	/** An ending was reached, or the story ran out (`key: null`). */
	ending: Ending;
	unlock: UnlockEvent;
	chapter: ChapterEvent;
	save: SaveEvent;
	/** Persistent data changed; the payload is the whole record, ready to store. */
	persist: NovelPersistent;
	/** A story problem the play continued past, a jump it could not take, or a failed listener. */
	error: NovelError;
}

/** The name of a novel event. */
export type NovelEventName = keyof NovelEvents;

/**
 * Reacts to one event. It receives the play it fired for, so concurrent plays stay apart; what
 * it returns is ignored, and a rejected promise is reported on `error`.
 *
 * @template Name - The event listened to.
 */
export type NovelListener<Name extends NovelEventName> = (
	payload: NovelEvents[Name],
	play: Play,
) => unknown;

/**
 * Registers listeners on a novel, so a feature such as achievements or analytics ships as one
 * function an app passes to `novel.use()`.
 */
export type NovelPlugin = (novel: Novel) => void;

/** Sends one event: the engine's view of the listeners, bound to its play. */
export type Emit = <Name extends NovelEventName>(name: Name, payload: NovelEvents[Name]) => void;

/** Any listener, as the registry stores it. */
type StoredListener = (payload: unknown, play: Play) => unknown;

/** The listeners of one novel, by event. */
export class Listeners {
	#listeners = new Map<NovelEventName, Set<StoredListener>>();

	/**
	 * Adds a listener.
	 *
	 * @param name - The event.
	 * @param listener - Called with the payload and the play.
	 * @returns A function that removes the listener.
	 */
	on<Name extends NovelEventName>(name: Name, listener: NovelListener<Name>): () => void {
		let set = this.#listeners.get(name) ?? new Set();
		set.add(listener as StoredListener);
		this.#listeners.set(name, set);
		return () => this.off(name, listener);
	}

	/**
	 * Removes a listener added with {@link Listeners.on}.
	 *
	 * @param name - The event.
	 * @param listener - The same function that was added.
	 */
	off<Name extends NovelEventName>(name: Name, listener: NovelListener<Name>): void {
		this.#listeners.get(name)?.delete(listener as StoredListener);
	}

	/**
	 * Calls every listener of `name`. A listener that throws or rejects is reported on `error`;
	 * a failing `error` listener is dropped, so a report can never loop.
	 *
	 * @param name - The event.
	 * @param payload - What every listener receives.
	 * @param play - The play the event fired for.
	 */
	emit<Name extends NovelEventName>(name: Name, payload: NovelEvents[Name], play: Play): void {
		let set = this.#listeners.get(name);
		if (set === undefined) return;
		for (let listener of set) {
			let report = (cause: unknown) => {
				if (name === "error") return;
				let error = new NovelError("listener-failed", `A "${name}" listener failed.`, {
					cause,
					subject: name,
				});
				this.emit("error", error, play);
			};
			try {
				let returned = listener(payload, play);
				if (isThenable(returned)) returned.then(undefined, report);
			} catch (error) {
				report(error);
			}
		}
	}
}

/** Reports whether a listener answered a promise, whose rejection must be caught too. */
function isThenable(value: unknown): value is PromiseLike<unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { then?: unknown }).then === "function"
	);
}
