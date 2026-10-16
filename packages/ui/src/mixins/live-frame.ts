/**
 * Live results for a text control rendered inside a frame: once typing pauses, the frame is
 * pointed at the address for the control's value and reloaded. Without JS the control still
 * submits its form, so the same address answers as a full page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/** DOM event type dispatched by {@link liveFrame} as a reload moves through its states. */
const LIVE_FRAME_EVENT = "ui:live-frame" as const;

/** DOM event type a consumer dispatches on a {@link liveFrame} host to reload it at once. */
export const LIVE_FRAME_RELOAD_EVENT = "ui:live-frame-reload";

/** How long typing must pause, in milliseconds, before the frame follows it. */
const DEFAULT_DEBOUNCE = 200;

/**
 * How long a reload may run, in milliseconds, before it counts as slow. Results arriving
 * within it swap in before any loading indicator would flash.
 */
const DEFAULT_SLOW_AFTER = 350;

declare global {
	interface HTMLElementEventMap {
		[LIVE_FRAME_EVENT]: LiveFrameEvent;
	}
}

/** Types for {@link liveFrame}. */
export namespace LiveFrame {
	/**
	 * Where a reload stands: `pending` once the value moves past what the frame shows, `slow`
	 * once that has lasted past `slowAfter`, `loading` just before the frame is replaced, and
	 * `settled` once the frame shows the newest value.
	 */
	export type State = "pending" | "slow" | "loading" | "settled";

	/** Configuration for {@link liveFrame}. */
	export interface Options {
		/** The frame address for a value, read each time the frame reloads. */
		src: (value: string) => string;
		/**
		 * @default 200
		 */
		debounce?: number;
		/**
		 * @default 350
		 */
		slowAfter?: number;
	}
}

/**
 * Dispatched on a {@link liveFrame} host as a reload moves through its states. Only the reload
 * for the newest value settles, so an answer to an older value never ends a newer wait.
 */
export class LiveFrameEvent extends Event {
	readonly state: LiveFrame.State;
	/** The address the frame is loading or showing. */
	readonly src: string;

	/**
	 * @param init The reload's state and the address it concerns.
	 */
	constructor(init: { state: LiveFrame.State; src: string }) {
		super(LIVE_FRAME_EVENT, { bubbles: true });
		this.state = init.state;
		this.src = init.src;
	}
}

/**
 * Reloads the host's frame from `src(value)` once typing pauses, and at once on
 * {@link LIVE_FRAME_RELOAD_EVENT}, which a consumer dispatches after changing the value or
 * anything else `src` reads. A value whose address the frame already shows settles in place.
 *
 * @example <input name="q" mix={[liveFrame({ src: (q) => `/frames/search?q=${encodeURIComponent(q)}` })]} />
 * @example input.value = ""; input.dispatchEvent(new Event(LIVE_FRAME_RELOAD_EVENT));
 */
export const liveFrame: MixinFactory<HTMLInputElement, [options: LiveFrame.Options]> = createMixin<
	HTMLInputElement,
	[options: LiveFrame.Options]
>((handle) => {
	let options: LiveFrame.Options = { src: () => handle.frame.src };
	let debounce: ReturnType<typeof setTimeout> | undefined;
	let slow: ReturnType<typeof setTimeout> | undefined;
	/** Counts requests, so a reload only settles when no newer one followed it. */
	let latest = 0;

	handle.signal.addEventListener("abort", () => {
		clearTimeout(debounce);
		clearTimeout(slow);
	});

	/** Tells listeners where the reload stands, from the host it concerns. */
	function report(host: HTMLInputElement, state: LiveFrame.State, src: string): void {
		host.dispatchEvent(new LiveFrameEvent({ state, src }));
	}

	/** Marks the value pending and restarts the wait that would call it slow. */
	function begin(host: HTMLInputElement): number {
		let request = ++latest;
		clearTimeout(slow);
		report(host, "pending", handle.frame.src);
		slow = setTimeout(
			() => report(host, "slow", handle.frame.src),
			options.slowAfter ?? DEFAULT_SLOW_AFTER,
		);
		return request;
	}

	/** Points the frame at the value's address and reloads it, unless it already shows it. */
	async function load(host: HTMLInputElement, request: number): Promise<void> {
		let src = options.src(host.value);
		if (src !== handle.frame.src) {
			report(host, "loading", src);
			handle.frame.src = src;
			await handle.frame.reload().catch(() => undefined);
		}
		if (request !== latest) return;
		clearTimeout(slow);
		report(host, "settled", src);
	}

	handle.addEventListener("insert", (event) => {
		let host = event.node;
		host.addEventListener(
			"input",
			() => {
				let request = begin(host);
				clearTimeout(debounce);
				debounce = setTimeout(() => void load(host, request), options.debounce ?? DEFAULT_DEBOUNCE);
			},
			{ signal: handle.signal },
		);
		host.addEventListener(
			LIVE_FRAME_RELOAD_EVENT,
			() => {
				clearTimeout(debounce);
				void load(host, begin(host));
			},
			{ signal: handle.signal },
		);
	});

	return (next) => {
		options = next;
	};
});
