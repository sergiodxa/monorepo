/**
 * Headless queue of toast notifications a Toast.Region island subscribes to,
 * re-rendering on change. Owns each toast's auto-dismiss timer, restarting it
 * with whatever time was left whenever a paused toast (or the whole queue)
 * resumes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TypedEventTarget } from "remix/ui";

import { dispatchChange } from "../utils/dispatch-change";

/** Auto-dismiss delay, in milliseconds, a toast uses when {@link Toaster.AddOptions.duration} is omitted. */
const DEFAULT_DURATION = 5000;

/**
 * Types associated with {@link Toaster}: the toast shape it queues, its
 * construction and per-toast options, and the events it dispatches.
 */
export namespace Toaster {
	/** One queued toast. */
	export interface Toast<Data = unknown> {
		/**
		 * Stable id used to target this toast with {@link Toaster.dismiss},
		 * {@link Toaster.update}, {@link Toaster.pause}, and {@link Toaster.resume}.
		 */
		readonly id: string;
		/** Consumer-supplied payload the island renders — copy, variant, action, and any other data the toast needs. */
		readonly data: Data;
		/** Milliseconds until this toast auto-dismisses, or `null` when it only leaves the queue through {@link Toaster.dismiss}. */
		readonly duration: number | null;
		/** `Date.now()` timestamp this toast was queued at. */
		readonly createdAt: number;
		/** `true` while this toast's auto-dismiss timer is paused. */
		readonly paused: boolean;
	}

	/** Options accepted by {@link Toaster.add}. */
	export interface AddOptions {
		/** Id to queue the toast under. Defaults to a generated id; reusing an id already queued replaces that toast. */
		id?: string;
		/**
		 * Milliseconds until auto-dismiss, or `null` for a toast that only
		 * leaves the queue through {@link Toaster.dismiss}. Defaults to the
		 * constructor's {@link Toaster.Init.defaultDuration}.
		 */
		duration?: number | null;
	}

	/** Options accepted by {@link Toaster.update}. */
	export interface UpdateOptions {
		/**
		 * Replacement duration. When provided, restarts the toast's
		 * auto-dismiss timer from full, preserving whether the toast is
		 * currently paused.
		 */
		duration?: number | null;
	}

	/** Construction options accepted by {@link Toaster}. */
	export interface Init {
		/** Auto-dismiss delay, in milliseconds, used when {@link Toaster.AddOptions.duration} is omitted. Defaults to 5000. */
		defaultDuration?: number;
	}

	/** Events dispatched by {@link Toaster}. */
	export interface Events {
		/** Dispatched after a toast is added, updated, dismissed (by timeout or by id), paused, resumed, or the queue is cleared. */
		change: Event;
		/** Dispatched after a new toast is added, ahead of `"change"`, so a listener can react to the arrival alone. */
		toast: Event;
	}
}

/**
 * Internal per-toast bookkeeping: the public {@link Toaster.Toast} fields
 * plus the timer state needed to pause and resume auto-dismiss.
 */
interface Entry<Data> {
	id: string;
	data: Data;
	duration: number | null;
	createdAt: number;
	/** Milliseconds left before dismissal; meaningful while `duration` is a number. */
	remaining: number;
	/** Timestamp the current countdown segment started at; `null` while paused or when `duration` is `null`. */
	startedAt: number | null;
	timer: ReturnType<typeof setTimeout> | null;
}

function toPublicToast<Data>(entry: Entry<Data>): Toaster.Toast<Data> {
	return {
		id: entry.id,
		data: entry.data,
		duration: entry.duration,
		createdAt: entry.createdAt,
		paused: entry.duration !== null && entry.startedAt === null,
	};
}

/**
 * Owns a queue of toast notifications and each one's auto-dismiss timer. An
 * island subscribes to `"change"` and calls {@link Toaster.pause} and
 * {@link Toaster.resume} so a toast under the cursor stays readable.
 *
 * @example
 * toaster.addEventListener("change", () => handle.update(), { signal: handle.signal });
 */
export class Toaster<Data = unknown> extends TypedEventTarget<Toaster.Events> {
	#toasts = new Map<string, Entry<Data>>();
	#defaultDuration: number;

	/**
	 * @param init Construction options; see {@link Toaster.Init}.
	 */
	constructor(init: Toaster.Init = {}) {
		super();

		this.#defaultDuration = init.defaultDuration ?? DEFAULT_DURATION;
	}

	/** Every queued toast, in the order it was added. */
	get toasts(): readonly Toaster.Toast<Data>[] {
		return Array.from(this.#toasts.values(), toPublicToast);
	}

	/** Number of toasts currently queued. */
	get size(): number {
		return this.#toasts.size;
	}

	/**
	 * Looks up one queued toast by id.
	 *
	 * @param id Id returned by {@link Toaster.add}.
	 * @returns The toast, or `undefined` when no toast with that id is queued.
	 */
	get(id: string): Toaster.Toast<Data> | undefined {
		let entry = this.#toasts.get(id);
		return entry ? toPublicToast(entry) : undefined;
	}

	/**
	 * Queues a toast and starts its auto-dismiss timer. Reusing an id already
	 * queued replaces that toast in place, clearing its previous timer.
	 * Dispatches `"toast"` and then `"change"`.
	 *
	 * @param data Consumer-supplied payload the island renders.
	 * @param options Id and duration overrides; see {@link Toaster.AddOptions}.
	 * @returns The id the toast was queued under.
	 * @example
	 * toaster.add({ title: "Saved" }, { duration: 3000 })
	 */
	add(data: Data, options: Toaster.AddOptions = {}): string {
		let id = options.id ?? crypto.randomUUID();
		let duration = options.duration === undefined ? this.#defaultDuration : options.duration;

		let existing = this.#toasts.get(id);
		if (existing) this.#clearTimer(existing);

		let now = Date.now();
		let entry: Entry<Data> = {
			id,
			data,
			duration,
			createdAt: now,
			remaining: duration ?? 0,
			startedAt: duration === null ? null : now,
			timer: null,
		};

		this.#toasts.set(id, entry);
		if (duration !== null) this.#schedule(entry, duration);

		this.dispatchEvent(new Event("toast"));
		dispatchChange(this);

		return id;
	}

	/**
	 * Patches a queued toast's data in place. Passing `duration` also restarts
	 * its timer from full, preserving whether the toast is currently paused.
	 *
	 * @param id Id returned by {@link Toaster.add}.
	 * @param data Replacement payload the island renders.
	 * @param options Duration override; see {@link Toaster.UpdateOptions}.
	 * @returns `true` when a toast with that id was found and updated, `false`
	 * otherwise.
	 */
	update(id: string, data: Data, options: Toaster.UpdateOptions = {}): boolean {
		let entry = this.#toasts.get(id);
		if (!entry) return false;

		entry.data = data;

		if (options.duration !== undefined) {
			let wasRunning = entry.startedAt !== null;

			this.#clearTimer(entry);
			entry.duration = options.duration;
			entry.remaining = entry.duration ?? 0;
			entry.startedAt = null;

			if (entry.duration !== null && wasRunning) {
				entry.startedAt = Date.now();
				this.#schedule(entry, entry.remaining);
			}
		}

		dispatchChange(this);
		return true;
	}

	/**
	 * Removes one queued toast by id and clears its timer.
	 *
	 * @param id Id returned by {@link Toaster.add}.
	 * @returns `true` when a toast with that id was found and removed, `false`
	 * otherwise.
	 */
	dismiss(id: string): boolean {
		let entry = this.#toasts.get(id);
		if (!entry) return false;

		this.#clearTimer(entry);
		this.#toasts.delete(id);
		dispatchChange(this);
		return true;
	}

	/** Empties the queue and clears every timer, dispatching `"change"` when it held at least one toast. */
	dismissAll(): void {
		if (this.#toasts.size === 0) return;

		for (let entry of this.#toasts.values()) this.#clearTimer(entry);
		this.#toasts.clear();
		dispatchChange(this);
	}

	/**
	 * Pauses the auto-dismiss timer for one toast, or every toast when `id` is
	 * omitted, recording how much time was left on each. Dispatches `"change"`
	 * only when at least one running timer paused.
	 *
	 * @param id Toast to pause, or every toast when omitted.
	 */
	pause(id?: string): void {
		let changed = false;

		if (id === undefined) {
			for (let entry of this.#toasts.values()) changed = this.#pauseEntry(entry) || changed;
		} else {
			let entry = this.#toasts.get(id);
			if (entry) changed = this.#pauseEntry(entry);
		}

		if (changed) dispatchChange(this);
	}

	/**
	 * Resumes the auto-dismiss timer for one toast, or every toast when `id` is
	 * omitted, continuing from the time left when it paused. Dispatches
	 * `"change"` only when at least one paused timer resumed.
	 *
	 * @param id Toast to resume, or every toast when omitted.
	 */
	resume(id?: string): void {
		let changed = false;

		if (id === undefined) {
			for (let entry of this.#toasts.values()) changed = this.#resumeEntry(entry) || changed;
		} else {
			let entry = this.#toasts.get(id);
			if (entry) changed = this.#resumeEntry(entry);
		}

		if (changed) dispatchChange(this);
	}

	/**
	 * Empties the queue and clears every pending timer silently, for an island
	 * to call as it unmounts so each countdown ends with it.
	 */
	dispose(): void {
		for (let entry of this.#toasts.values()) this.#clearTimer(entry);
		this.#toasts.clear();
	}

	/** Pauses one entry's timer, recording the time left. Returns `true` when it was running and is now paused. */
	#pauseEntry(entry: Entry<Data>): boolean {
		if (entry.duration === null || entry.startedAt === null) return false;

		entry.remaining = Math.max(0, entry.remaining - (Date.now() - entry.startedAt));
		this.#clearTimer(entry);
		entry.startedAt = null;
		return true;
	}

	/** Resumes one entry's timer from its recorded time left. Returns `true` when it was paused and is now running. */
	#resumeEntry(entry: Entry<Data>): boolean {
		if (entry.duration === null || entry.startedAt !== null) return false;

		entry.startedAt = Date.now();
		this.#schedule(entry, entry.remaining);
		return true;
	}

	/** Schedules an entry to be removed from the queue, dispatching `"change"`, after `delay` milliseconds. */
	#schedule(entry: Entry<Data>, delay: number): void {
		entry.timer = setTimeout(() => {
			this.#toasts.delete(entry.id);
			dispatchChange(this);
		}, delay);
	}

	#clearTimer(entry: Entry<Data>): void {
		if (entry.timer === null) return;

		clearTimeout(entry.timer);
		entry.timer = null;
	}
}
