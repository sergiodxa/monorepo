/**
 * Keeps the frame that renders the host current: it reloads on a schedule, on an event, or
 * both, and rests while the page is hidden. JS is what triggers the reloads; without it the
 * frame shows what the page loaded with until the reader reloads the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { whileLive } from "./while-live.js";

/** Types for {@link frameRefresh}. */
export namespace FrameRefresh {
	/** Configuration for {@link frameRefresh}; give `every`, `on`, or both. */
	export interface Options {
		/** Milliseconds between the end of one reload and the start of the next. */
		every?: number;
		/** DOM event type that reloads the frame when it reaches the host, read once on insert. */
		on?: string;
		/** Read before each reload; once it answers `true` the host stops reloading the frame. */
		until?: () => boolean;
	}
}

/**
 * Reloads the host's enclosing frame every `every` milliseconds and whenever the `on` event
 * reaches the host. One reload runs at a time: an event during a reload queues one more. The
 * schedule pauses while the page is hidden and reloads once when it is shown again.
 *
 * @example <section mix={[frameRefresh({ every: 30_000 })]}>…</section>
 * @example <div mix={[frameRefresh({ on: "app:saved", until: () => done })]}>…</div>
 */
export const frameRefresh: MixinFactory<Element, [options: FrameRefresh.Options]> = createMixin<
	Element,
	[options: FrameRefresh.Options]
>((handle) => {
	let options: FrameRefresh.Options = {};
	let timer: ReturnType<typeof setTimeout> | undefined;
	let running = false;
	let queued = false;
	let stopped = false;
	/** Aborts once the host leaves the document, ending the schedule with it. */
	let live: AbortSignal | undefined;

	/** Whether the stop condition has been met, which ends every later reload for good. */
	function finished(): boolean {
		if (!stopped && options.until?.() === true) stopped = true;
		return stopped;
	}

	/** Waits `every` milliseconds before the next reload, while the page is shown. */
	function schedule(): void {
		clearTimeout(timer);
		timer = undefined;
		if (options.every === undefined || finished() || document.hidden) return;
		timer = setTimeout(() => void refresh(), options.every);
	}

	/** Reloads the frame unless one is running, then starts the wait for the next one. */
	async function refresh(): Promise<void> {
		clearTimeout(timer);
		if (!live || live.aborted || finished()) return;
		if (running) {
			queued = true;
			return;
		}

		running = true;
		try {
			await handle.frame.reload();
		} catch {
			/** A failed reload leaves the frame as it was; the schedule tries again on its next turn. */
		} finally {
			running = false;
		}

		if (live.aborted) return;
		if (queued) {
			queued = false;
			return refresh();
		}
		schedule();
	}

	let follow = whileLive(handle, (host: Element, signal) => {
		live = signal;
		signal.addEventListener("abort", () => clearTimeout(timer));
		host.ownerDocument.addEventListener(
			"visibilitychange",
			() => {
				if (host.ownerDocument.hidden) clearTimeout(timer);
				else if (options.every !== undefined) void refresh();
			},
			{ signal },
		);
		if (options.on) host.addEventListener(options.on, () => void refresh(), { signal });
		schedule();
	});

	handle.addEventListener("insert", (event) => follow(event.node));

	return (next) => {
		options = next;
	};
});
