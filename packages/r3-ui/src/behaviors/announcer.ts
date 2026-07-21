/**
 * Headless queue of aria-live announcements, decoupled from any rendering so
 * a live-region island can subscribe to its state and re-render on change.
 * Backs transient accessibility announcements such as Command match counts,
 * drag-and-drop position updates, and toast messages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TypedEventTarget } from "remix/ui";

const DEFAULT_PRIORITY: Announcer.Priority = "polite";

/**
 * Types describing the announcements and events {@link Announcer} owns.
 */
export namespace Announcer {
	/**
	 * Politeness setting a queued message announces with, mirrored onto a
	 * live region's `aria-live` attribute. `"polite"` waits for the current
	 * utterance to finish; `"assertive"` interrupts it and moves ahead of any
	 * `"polite"` messages already queued.
	 */
	export type Priority = "polite" | "assertive";

	/**
	 * One queued announcement.
	 */
	export interface Message {
		/** Stable id used to target this message with {@link Announcer.dismiss}. */
		readonly id: string;
		/** Announcement copy, read verbatim by the live region. */
		readonly text: string;
		/** Politeness setting this message announces with. */
		readonly priority: Priority;
	}

	/**
	 * Events dispatched by {@link Announcer}.
	 */
	export interface Events {
		/** Dispatched after a message is queued, dismissed, advanced past, or the queue is cleared. */
		change: Event;
	}
}

/**
 * Owns a priority-ordered queue of aria-live announcements. A live-region
 * island subscribes to the `"change"` event, renders {@link Announcer.current}
 * into an `aria-live` element, and calls {@link Announcer.next} once the
 * announcement has had time to be read.
 *
 * @example
 * announcer.addEventListener("change", () => handle.update(), { signal: handle.signal });
 */
export class Announcer extends TypedEventTarget<Announcer.Events> {
	#queue: Announcer.Message[] = [];

	/**
	 * The message a live region should currently render, or `undefined` when
	 * the queue is empty.
	 */
	get current(): Announcer.Message | undefined {
		return this.#queue.at(0);
	}

	/**
	 * Every queued message, in the order a live region should announce them.
	 */
	get messages(): readonly Announcer.Message[] {
		return this.#queue;
	}

	/**
	 * Queues a message for announcement. Assertive messages are inserted
	 * ahead of any polite messages already queued, so they interrupt the
	 * live region, but behind assertive messages queued earlier. Polite
	 * messages are appended to the end of the queue.
	 *
	 * @param text Announcement copy, read verbatim by the live region.
	 * @param priority Politeness setting the message announces with. Defaults to `"polite"`.
	 * @returns The generated id, usable with {@link Announcer.dismiss}.
	 * @example
	 * announcer.announce("5 results found");
	 */
	announce(text: string, priority: Announcer.Priority = DEFAULT_PRIORITY): string {
		let message: Announcer.Message = { id: crypto.randomUUID(), text, priority };

		if (priority === "assertive") {
			let index = this.#queue.findIndex((queued) => queued.priority !== "assertive");

			if (index === -1) this.#queue.push(message);
			else this.#queue.splice(index, 0, message);
		} else this.#queue.push(message);

		this.dispatchEvent(new Event("change"));

		return message.id;
	}

	/**
	 * Removes one queued message by id, wherever it sits in the queue. Does
	 * nothing if no message with that id is queued.
	 *
	 * @param id Id returned by {@link Announcer.announce}.
	 */
	dismiss(id: string): void {
		let index = this.#queue.findIndex((message) => message.id === id);

		if (index === -1) return;

		this.#queue.splice(index, 1);
		this.dispatchEvent(new Event("change"));
	}

	/**
	 * Advances past the current message, so the next queued message, if
	 * any, becomes {@link Announcer.current}. Does nothing when the queue is
	 * already empty.
	 */
	next(): void {
		if (this.#queue.length === 0) return;

		this.#queue.shift();
		this.dispatchEvent(new Event("change"));
	}

	/**
	 * Empties the queue. Does nothing when the queue is already empty.
	 */
	clear(): void {
		if (this.#queue.length === 0) return;

		this.#queue = [];
		this.dispatchEvent(new Event("change"));
	}
}
