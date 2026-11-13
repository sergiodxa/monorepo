/**
 * The timer behind a list that refreshes itself: it runs a reload every interval, one at a
 * time, waits while paused, and on resume reloads at once when an interval has passed. It
 * holds no DOM, so the island adapter decides what pauses it and what a reload is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TypedEventTarget } from "remix/component";

/** Types for {@link RefreshSchedule}. */
export namespace RefreshSchedule {
	/** Construction options. */
	export interface Init {
		/** Milliseconds from the end of one reload to the start of the next; 0 or less never reloads. */
		every: number;
		/** Reloads what the schedule keeps current; a rejection leaves the schedule running. */
		reload: () => Promise<unknown>;
		/**
		 * When the content on screen was last fetched, which the schedule reports until its first
		 * reload; the first interval counts from construction, so a cached page reloads on schedule.
		 * Defaults to construction time.
		 */
		refreshedAt?: Date;
	}

	/** Events dispatched by {@link RefreshSchedule}. */
	export interface Events {
		/** A reload finished; read `refreshedAt` for when. */
		refresh: Event;
	}
}

/**
 * Reloads on an interval measured from the last finished reload (the first from when it was
 * created), so a slow reload never stacks a second one behind it, and a resume after a long
 * pause catches up with one reload.
 *
 * @example let schedule = new RefreshSchedule({ every: 30_000, reload: () => frame.reload() }); schedule.start();
 */
export class RefreshSchedule extends TypedEventTarget<RefreshSchedule.Events> {
	/** Milliseconds between reloads. */
	readonly every: number;
	#reload: () => Promise<unknown>;
	#refreshedAt: Date;
	/** When the last reload attempt ended, failed or not, which the next interval counts from. */
	#attemptedAt: number;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#running = false;
	#paused = true;
	#stopped = false;

	/**
	 * @param init The interval and the reload to run.
	 */
	constructor(init: RefreshSchedule.Init) {
		super();
		this.every = init.every;
		this.#reload = init.reload;
		this.#refreshedAt = init.refreshedAt ?? new Date();
		this.#attemptedAt = Date.now();
	}

	/** When the last reload finished, or the initial content was fetched. */
	get refreshedAt(): Date {
		return this.#refreshedAt;
	}

	/** Whether the schedule is waiting to be resumed. */
	get paused(): boolean {
		return this.#paused;
	}

	/** Starts counting toward the next reload from the last refresh. */
	start(): void {
		this.resume();
	}

	/** Holds the next reload until {@link resume}; a reload already running finishes. */
	pause(): void {
		this.#paused = true;
		clearTimeout(this.#timer);
		this.#timer = undefined;
	}

	/** Continues the schedule, reloading at once when a full interval passed while paused. */
	resume(): void {
		if (this.#stopped || this.every <= 0) return;
		this.#paused = false;
		this.#schedule();
	}

	/** Ends the schedule for good. */
	stop(): void {
		this.pause();
		this.#stopped = true;
	}

	/** Arms the timer for whatever remains of the interval since the last refresh. */
	#schedule(): void {
		clearTimeout(this.#timer);
		if (this.#paused || this.#running || this.#stopped) return;
		let remaining = this.every - (Date.now() - this.#attemptedAt);
		this.#timer = setTimeout(() => void this.#run(), Math.max(0, remaining));
	}

	/** Runs one reload, then arms the next. */
	async #run(): Promise<void> {
		this.#timer = undefined;
		if (this.#paused || this.#stopped) return;
		this.#running = true;
		try {
			await this.#reload();
			this.#refreshedAt = new Date();
			this.dispatchEvent(new Event("refresh"));
		} catch {
			/** A failed reload keeps the old content and its time; the next interval tries again. */
		} finally {
			this.#running = false;
			this.#attemptedAt = Date.now();
		}
		this.#schedule();
	}
}
