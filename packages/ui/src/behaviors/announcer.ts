/**
 * Headless queue of aria-live announcements: a live-region island subscribes
 * to its state and re-renders on change. Backs transient accessibility
 * announcements such as match counts, drag-and-drop position updates, and
 * toast messages.
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
	 * Politeness a queued message announces with, mirrored onto a live
	 * region's `aria-live` attribute. `"assertive"` interrupts the current
	 * utterance and moves ahead of any `"polite"` messages already queued.
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
		readonly priority: Priority;
	}

	/**
	 * Events dispatched by {@link Announcer}.
	 */
	export interface Events {
		/**
		 * Dispatched after a message is queued, dismissed, advanced past, or
		 * the queue is cleared.
		 */
		change: Event;
	}
}

/**
 * Owns a priority-ordered queue of aria-live announcements. A live-region
 * island subscribes to `"change"`, renders {@link Announcer.current} into an
 * `aria-live` element, and calls {@link Announcer.next} once it has been read.
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
	 * Queues a message for announcement. Assertive messages are inserted ahead
	 * of any polite messages already queued so they interrupt the live region,
	 * and behind assertive messages queued earlier; polite messages append.
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
	 * Removes one queued message by id, wherever it sits in the queue,
	 * dispatching `"change"` only when a message with that id was queued.
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
	 * Advances past the current message so the next queued one becomes
	 * {@link Announcer.current}, dispatching `"change"` only when the queue
	 * held a message.
	 */
	next(): void {
		if (this.#queue.length === 0) return;

		this.#queue.shift();
		this.dispatchEvent(new Event("change"));
	}

	/**
	 * Empties the queue, dispatching `"change"` only when it held messages.
	 */
	clear(): void {
		if (this.#queue.length === 0) return;

		this.#queue = [];
		this.dispatchEvent(new Event("change"));
	}
}
