/**
 * Why JS: an autosave's progress and the age of the last edit change after the page has
 * rendered, so script moves a save status through Saving…, Saved and the edit time.
 * No-JS baseline: the status shows the state the server rendered, and Retry submits its form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { formatEditedTime } from "../utils/edited-time.js";

/** Event an app dispatches on a save status, through {@link setSaveStatus}, to report a save. */
const SAVE_STATUS_EVENT = "ui:save-status" as const;

/** Event a save status dispatches, bubbling, when Retry is pressed. */
const SAVE_STATUS_RETRY_EVENT = "ui:save-status-retry" as const;

/** How often the relative edit time redraws. */
const TICK_MS = 30_000;

declare global {
	interface HTMLElementEventMap {
		[SAVE_STATUS_EVENT]: SaveStatusEvent;
		[SAVE_STATUS_RETRY_EVENT]: SaveStatusRetryEvent;
	}
}

/** Types for {@link saveStatusSync}. */
export namespace SaveStatusSync {
	/** Where a save stands; `"idle"` shows the last edit time, or nothing without one. */
	export type State = "idle" | "saving" | "saved" | "failed";

	/** Configuration for {@link saveStatusSync}. */
	export interface Options {
		/** The state the server rendered. */
		state: State;
		/** When the content was last edited, as an ISO string. */
		editedAt?: string;
		labels: { saving: string; saved: string; failed: string; edited: string };
		locale?: string;
		holdMs: number;
		savedMs: number;
		decayMs: number;
	}
}

/** Reports a save to a save status: dispatched on it by {@link setSaveStatus}. */
export class SaveStatusEvent extends Event {
	readonly state: SaveStatusSync.State;
	/** When the content was saved; the moment the event arrives when omitted. */
	readonly at: Date | undefined;

	/**
	 * @param state Where the save stands.
	 * @param at When the content was saved.
	 */
	constructor(state: SaveStatusSync.State, at?: Date) {
		super(SAVE_STATUS_EVENT);
		this.state = state;
		this.at = at;
	}
}

/** Dispatched, bubbling, from a save status when its Retry is pressed, for an autosave to try again. */
export class SaveStatusRetryEvent extends Event {
	constructor() {
		super(SAVE_STATUS_RETRY_EVENT, { bubbles: true });
	}
}

/**
 * Reports a save to a save status, which is how an autosave drives it.
 *
 * @param target The status element or its `id`.
 * @param state Where the save stands.
 * @param at When the content was saved.
 * @example
 * setSaveStatus("post-status", "saving");
 * let response = await fetch(url, { method: "POST", body });
 * setSaveStatus("post-status", response.ok ? "saved" : "failed");
 */
export function setSaveStatus(
	target: Element | string,
	state: SaveStatusSync.State,
	at?: Date,
): void {
	let element = typeof target === "string" ? document.getElementById(target) : target;
	element?.dispatchEvent(new SaveStatusEvent(state, at));
}

/**
 * Applied to a save status (`[data-slot="save-status"]`): "Saving…" holds for `holdMs`
 * however fast the save, "Saved" shows for `savedMs`, then the edit time shows and keeps
 * its age current. It writes `data-state` and the texts of its `save-status-*` parts.
 *
 * @example <span data-slot="save-status" mix={[saveStatusSync({ state: "idle", labels, holdMs: 1000, savedMs: 3000, decayMs: 86_400_000 })]}>…</span>
 */
export const saveStatusSync: MixinFactory<HTMLElement, [options: SaveStatusSync.Options]> =
	createMixin<HTMLElement, [options: SaveStatusSync.Options]>((handle) => {
		let options: SaveStatusSync.Options | undefined;
		let controller: AbortController | undefined;

		handle.addEventListener("insert", (event) => {
			controller?.abort();
			controller = new AbortController();
			if (options) connect(event.node, () => options!, controller.signal);
		});

		handle.addEventListener("remove", () => {
			controller?.abort();
			controller = undefined;
		});

		return (next) => {
			options = next;
		};
	});

/**
 * Runs `root`'s state machine until `signal` aborts.
 *
 * @param root The status element.
 * @param read Reads the latest options.
 * @param signal Ends every timer and listener once the status leaves the document.
 */
function connect(root: HTMLElement, read: () => SaveStatusSync.Options, signal: AbortSignal): void {
	let text = root.querySelector<HTMLElement>('[data-slot="save-status-text"]');
	let edited = root.querySelector<HTMLTimeElement>('[data-slot="save-status-edited"]');
	let retry = root.querySelector<HTMLElement>('[data-slot="save-status-retry"]');
	let initial = read();
	let shown = initial.state;
	let editedAt = initial.editedAt ? new Date(initial.editedAt) : null;
	let savingSince = shown === "saving" ? Date.now() : 0;
	let pending: ReturnType<typeof setTimeout> | undefined;

	/** Writes `shown` and the edit time into the element's parts. */
	let draw = () => {
		let { labels, locale, decayMs } = read();
		root.dataset.state = shown;
		if (text) text.textContent = shown === "idle" ? "" : labels[shown];
		if (retry) retry.hidden = shown !== "failed";
		if (!edited) return;
		edited.hidden = shown !== "idle" || editedAt === null;
		if (!editedAt) return;
		edited.dateTime = editedAt.toISOString();
		edited.title = editedAt.toLocaleString(locale);
		edited.textContent = labels.edited.replace(
			"{time}",
			formatEditedTime(editedAt, new Date(), decayMs, locale),
		);
	};

	/** Shows `next` now. */
	let show = (next: SaveStatusSync.State) => {
		shown = next;
		draw();
	};

	/** Shows "Saved", then decays to the edit time. */
	let settleSaved = (at: Date) => {
		editedAt = at;
		show("saved");
		pending = setTimeout(() => show("idle"), read().savedMs);
	};

	root.addEventListener(
		SAVE_STATUS_EVENT,
		(event) => {
			clearTimeout(pending);
			if (event.state === "saving") {
				if (shown !== "saving") savingSince = Date.now();
				show("saving");
				return;
			}
			let held = shown === "saving" ? Date.now() - savingSince : Infinity;
			let wait = Math.max(0, read().holdMs - held);
			let settle = () => {
				if (event.state === "saved") return settleSaved(event.at ?? new Date());
				if (event.at) editedAt = event.at;
				show(event.state);
			};
			if (wait > 0) pending = setTimeout(settle, wait);
			else settle();
		},
		{ signal },
	);
	retry
		?.querySelector("button")
		?.addEventListener("click", () => root.dispatchEvent(new SaveStatusRetryEvent()), {
			signal,
		});

	let tick = setInterval(() => {
		if (shown === "idle") draw();
	}, TICK_MS);
	if (shown === "saved") pending = setTimeout(() => show("idle"), initial.savedMs);
	signal.addEventListener("abort", () => {
		clearInterval(tick);
		clearTimeout(pending);
	});
	draw();
}
