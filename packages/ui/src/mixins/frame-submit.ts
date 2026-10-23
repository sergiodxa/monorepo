/**
 * Submits a form into the frame that renders it: the frame posts the form's data and renders
 * the answer in one request, keeping its own address for later reloads. JS is what sends the
 * data through the frame; without it the form submits as a normal document request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { whileLive } from "./while-live.js";

/** DOM event type dispatched by {@link frameSubmit} as a submission moves through its states. */
const FRAME_SUBMIT_EVENT = "ui:frame-submit" as const;

declare global {
	interface HTMLElementEventMap {
		[FRAME_SUBMIT_EVENT]: FrameSubmitEvent;
	}
}

/** Types for {@link frameSubmit}. */
export namespace FrameSubmit {
	/**
	 * Where a submission stands: `pending` once it is sent, `settled` once the frame shows the
	 * answer, `aborted` when a newer reload of the frame replaced it, and `failed` when the
	 * frame could not load the answer.
	 */
	export type State = "pending" | "settled" | "aborted" | "failed";

	/** Configuration for {@link frameSubmit}. */
	export interface Options {
		/**
		 * Keeps the frame's own address for later reloads. Set `false` to have the frame adopt
		 * the form's action as its address once the submission settles.
		 *
		 * @default true
		 */
		keepSrc?: boolean;
	}
}

/**
 * Dispatched on a {@link frameSubmit} form as a submission moves through its states. Each
 * submission reports `pending` and then exactly one of the other states.
 */
export class FrameSubmitEvent extends Event {
	/** Where the submission stands; `pending` always comes first. */
	readonly state: FrameSubmit.State;
	/** The address the form submitted to. */
	readonly action: string;
	/** Why the frame could not load the answer, set only on `failed`. */
	readonly error: unknown;

	/**
	 * @param init The submission's state, its address, and the failure when it failed.
	 */
	constructor(init: { state: FrameSubmit.State; action: string; error?: unknown }) {
		super(FRAME_SUBMIT_EVENT, { bubbles: true });
		this.state = init.state;
		this.action = init.action;
		this.error = init.error;
	}
}

/** The request a submission makes, with the submitter's overrides applied over the form's own. */
interface Submission {
	action: string;
	method: string;
	encType: string;
	body: FormData;
}

/**
 * Reads the submission the browser would make, honoring `formaction`, `formmethod` and
 * `formenctype` on the button that submitted it.
 */
function readSubmission(form: HTMLFormElement, submitter: HTMLElement | null): Submission {
	let button =
		submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
			? submitter
			: null;

	return {
		action: button?.hasAttribute("formaction") ? button.formAction : form.action,
		method: button?.hasAttribute("formmethod") ? button.formMethod : form.method,
		encType: button?.hasAttribute("formenctype") ? button.formEnctype : form.enctype,
		body: new FormData(form, button),
	};
}

/**
 * Sends the form's submission through its enclosing frame, marking the form `aria-busy` until
 * the answer renders there; the frame then returns to its own address, so the action answers a
 * frame request with the frame's content, a redirect to it included. A newer submission wins.
 *
 * @example <form method="post" action="/actions/rename" mix={[frameSubmit()]}>…</form>
 * @example form.addEventListener("ui:frame-submit", (event) => event.state === "failed" && retry());
 */
export const frameSubmit: MixinFactory<HTMLFormElement, [options?: FrameSubmit.Options]> =
	createMixin<HTMLFormElement, [options?: FrameSubmit.Options]>((handle) => {
		let options: FrameSubmit.Options = {};
		/** Counts submissions, so only the newest one clears the form's busy state. */
		let latest = 0;

		/** Sends one submission through the frame and reports how it ended. */
		async function submit(form: HTMLFormElement, submission: Submission): Promise<void> {
			let request = ++latest;
			let frame = handle.frame;
			let previous = frame.src;
			let report = (state: FrameSubmit.State, error?: unknown) =>
				form.dispatchEvent(new FrameSubmitEvent({ state, action: submission.action, error }));

			form.setAttribute("aria-busy", "true");
			report("pending");

			let { action, method, encType, body } = submission;
			let reload = frame.reload({ src: action, method, encType, body });
			/** The address the reload settled on, with a GET submission's fields in its query. */
			let submitted = frame.src;

			try {
				let signal = await reload;
				report(signal.aborted ? "aborted" : "settled");
			} catch (error) {
				report("failed", error);
			} finally {
				/** A newer reload owns the address once it has moved off this submission's. */
				if ((options.keepSrc ?? true) && frame.src === submitted) frame.src = previous;
				if (request === latest) form.removeAttribute("aria-busy");
			}
		}

		let follow = whileLive(handle, (form: HTMLFormElement, signal) => {
			form.addEventListener(
				"submit",
				(event) => {
					let submission = readSubmission(form, event.submitter);
					if (submission.method === "dialog") return;

					event.preventDefault();
					let skipValidation =
						form.noValidate || event.submitter?.hasAttribute("formnovalidate") === true;
					if (!skipValidation && !form.reportValidity()) return;

					void submit(form, submission);
				},
				{ signal },
			);
		});

		handle.addEventListener("insert", (event) => follow(event.node));

		return (next) => {
			options = next ?? {};
		};
	});
