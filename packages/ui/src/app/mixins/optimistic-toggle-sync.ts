/**
 * Why JS: a form post replaces the page, so script is what flips a toggle the moment it is
 * pressed, posts the same form data in the background, and puts the toggle back on failure.
 * No-JS baseline: the form posts the next state as a plain submission.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/** Event a toggle's form dispatches, bubbling, whenever its state changes. */
const OPTIMISTIC_TOGGLE_EVENT = "ui:optimistic-toggle" as const;

/** Header a background post carries, so the server can answer with a status instead of a redirect. */
export const OPTIMISTIC_TOGGLE_HEADER = "x-optimistic-toggle";

declare global {
	interface HTMLElementEventMap {
		[OPTIMISTIC_TOGGLE_EVENT]: OptimisticToggleEvent;
	}
}

/** Types for {@link optimisticToggleSync}. */
export namespace OptimisticToggleSync {
	/** Configuration for {@link optimisticToggleSync}. */
	export interface Options {
		/** What the form's live region says once the server refuses a change, such as "Failed". */
		failed: string;
		/** What it says instead for a refusal with one of these statuses, such as a full shelf's 507. */
		refused?: Record<number, string>;
		/** The button's title and, when it has one, `aria-label` while off; left as rendered when omitted. */
		label?: string;
		/** The button's title and `aria-label` while on; `label` when omitted. */
		pressedLabel?: string;
	}

	/** Where a press stands, as {@link OptimisticToggleEvent} reports it. */
	export interface Outcome {
		/** The server refused the change. */
		failed?: boolean;
		/** The server answered, with success or a refusal. */
		settled?: boolean;
		/** The answer's HTTP status; `null` before the answer and for a network error. */
		status?: number | null;
	}
}

/**
 * Dispatched, bubbling, from a toggle's form at the press and again once the server answers,
 * so a row can restyle at once and reload server-derived counts only when `settled` is true.
 */
export class OptimisticToggleEvent extends Event {
	readonly pressed: boolean;
	/** Whether the server refused the last change, which put the toggle back. */
	readonly failed: boolean;
	/** Whether the server has answered the press: false for the optimistic flip, true after. */
	readonly settled: boolean;
	/** The answer's HTTP status, for picking copy; `null` before the answer and for a network error. */
	readonly status: number | null;

	/**
	 * @param pressed Whether the toggle is now on.
	 * @param outcome How the press stands: answered at all, refused, and with which status.
	 */
	constructor(pressed: boolean, outcome: OptimisticToggleSync.Outcome = {}) {
		super(OPTIMISTIC_TOGGLE_EVENT, { bubbles: true });
		this.pressed = pressed;
		this.failed = outcome.failed ?? false;
		this.settled = outcome.settled ?? false;
		this.status = outcome.status ?? null;
	}
}

/**
 * Applied to the toggle's `<form>`: on submit it flips `data-pressed`, the button's
 * `aria-pressed`, tone and name, and the hidden next-state field, then posts the form as it stood.
 * A refused post flips it back, sets `data-failed` and writes the `refused` copy for its status,
 * or `failed`, into the live region.
 * The newest press wins over a slow answer to an older one, and only its answer is reported.
 *
 * @example <form method="post" action={url} mix={[optimisticToggleSync({ failed: "Failed" })]}>…</form>
 */
export const optimisticToggleSync: MixinFactory<
	HTMLFormElement,
	[options: OptimisticToggleSync.Options]
> = createMixin<HTMLFormElement, [options: OptimisticToggleSync.Options]>((handle) => {
	let options: OptimisticToggleSync.Options | undefined;
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		controller = new AbortController();
		connect(event.node, () => options, controller.signal);
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
 * Handles `form`'s submissions until `signal` aborts.
 *
 * @param form The toggle's form.
 * @param read Reads the latest options.
 * @param signal Ends the listener once the form leaves the document.
 */
function connect(
	form: HTMLFormElement,
	read: () => OptimisticToggleSync.Options | undefined,
	signal: AbortSignal,
): void {
	let button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
	let next = form.querySelector<HTMLInputElement>("input[data-toggle-next]");
	let status = form.querySelector<HTMLElement>('[role="status"]');
	let latest = 0;

	/** Draws `pressed` and the outcome onto the form and tells the page. */
	let show = (pressed: boolean, outcome: OptimisticToggleSync.Outcome) => {
		let failed = outcome.failed ?? false;
		form.toggleAttribute("data-pressed", pressed);
		form.toggleAttribute("data-failed", failed);
		if (next) next.value = pressed ? "false" : "true";
		if (button) {
			button.setAttribute("aria-pressed", pressed ? "true" : "false");
			button.dataset.color = toneOf(pressed, failed);
			name(button, pressed, read());
		}
		if (status) status.textContent = failed ? refusal(read(), outcome.status ?? null) : "";
		form.dispatchEvent(new OptimisticToggleEvent(pressed, outcome));
	};

	form.addEventListener(
		"submit",
		async (event) => {
			event.preventDefault();
			let body = new FormData(form);
			let previous = form.hasAttribute("data-pressed");
			let token = ++latest;

			show(!previous, {});

			let answer = await fetch(form.action, {
				method: "POST",
				credentials: "same-origin",
				headers: { [OPTIMISTIC_TOGGLE_HEADER]: "1" },
				body,
			}).then(
				(response) => ({ ok: response.ok, status: response.status }),
				() => ({ ok: false, status: null }),
			);

			if (token !== latest || signal.aborted) return;
			if (answer.ok) show(!previous, { settled: true, status: answer.status });
			else show(previous, { failed: true, settled: true, status: answer.status });
		},
		{ signal },
	);
}

/**
 * Renames `button` for its state, so its title and accessible name follow a flip; a button
 * named by its content keeps its content as the name, with no `aria-label` added.
 *
 * @param button The toggle's button.
 * @param pressed Whether the toggle is on.
 * @param options The toggle's latest options.
 */
function name(
	button: HTMLButtonElement,
	pressed: boolean,
	options: OptimisticToggleSync.Options | undefined,
): void {
	if (options?.label === undefined) return;
	let label = pressed ? (options.pressedLabel ?? options.label) : options.label;
	button.title = label;
	if (button.hasAttribute("aria-label")) button.setAttribute("aria-label", label);
}

/**
 * Picks the live region's copy for a refusal: the `refused` entry for its status when one is
 * listed, `failed` for any other status and for a network error.
 *
 * @param options The toggle's latest options.
 * @param status The refusal's HTTP status, or `null` when the request never got an answer.
 * @returns The text the live region shows.
 */
function refusal(options: OptimisticToggleSync.Options | undefined, status: number | null): string {
	if (!options) return "";
	if (status !== null && options.refused?.[status] !== undefined) return options.refused[status];
	return options.failed;
}

/**
 * Picks the button's tone: danger after a refusal, brand while on, neutral while off.
 *
 * @param pressed Whether the toggle is on.
 * @param failed Whether the last change was refused.
 * @returns The semantic color role the button wears.
 */
export function toneOf(pressed: boolean, failed: boolean): "danger" | "brand" | "neutral" {
	if (failed) return "danger";
	return pressed ? "brand" : "neutral";
}
