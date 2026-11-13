/**
 * Why JS: re-pricing while a reader types or drags needs input events, a debounce and a frame
 * reload, which a GET form cannot do on its own. No-JS baseline: the form submits by GET and
 * the page renders the bill for the new query.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/** Types for {@link usageEstimateLive}. */
export namespace UsageEstimateLiveMixin {
	/** Configuration for {@link usageEstimateLive}, read on every event. */
	export interface Options {
		/** Loads the bill for `src`, the form's address with its current query. */
		reload: (src: string) => Promise<unknown>;
		/** Milliseconds of quiet after the last input before the bill is requested. */
		delay: number;
	}
}

/**
 * Applied inside a calculator's GET form: once the fields go quiet for `delay`, and on a
 * submit from Enter or an unnamed button, it reloads the bill for the form's query; a named
 * button still loads the page. Only the newest request moves the address (`replaceState`).
 *
 * @example <span hidden mix={[usageEstimateLive({ reload: (src) => frame.reload({ src }), delay: 250 })]} />
 */
export const usageEstimateLive: MixinFactory<
	HTMLElement,
	[options: UsageEstimateLiveMixin.Options]
> = createMixin<HTMLElement, [options: UsageEstimateLiveMixin.Options]>((handle) => {
	let options: UsageEstimateLiveMixin.Options | undefined;
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		controller = new AbortController();
		let form = event.node.closest("form");
		if (form !== null) follow(form, () => options, controller.signal);
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
 * Listens to `form` until `signal` aborts, reading the latest options on each event so a
 * re-rendered island's new callback is the one used.
 *
 * @param form The calculator's GET form.
 * @param current Returns the options in force.
 * @param signal Ends the listeners and any pending timer.
 */
function follow(
	form: HTMLFormElement,
	current: () => UsageEstimateLiveMixin.Options | undefined,
	signal: AbortSignal,
): void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	/** Counts requests, so only the newest one moves the address or falls back to a submit. */
	let latest = 0;
	signal.addEventListener("abort", () => clearTimeout(timer));

	/**
	 * Reloads the bill for the form's query and moves the address to it once it has landed.
	 * A request a newer one overtook settles without touching the address, and its failure
	 * is swallowed, since the newer request owns the bill.
	 */
	let price = async () => {
		let request = ++latest;
		let options = current();
		if (options === undefined) throw new Error("usageEstimateLive has no options");
		let target = addressOf(form);
		try {
			await options.reload(`${target.pathname}${target.search}`);
		} catch (error) {
			if (request === latest) throw error;
			return;
		}
		if (signal.aborted || request !== latest) return;
		let { history, location } = form.ownerDocument.defaultView ?? window;
		let next = `${target.pathname}${target.search}${location.hash}`;
		if (next !== `${location.pathname}${location.search}${location.hash}`) {
			history.replaceState(history.state, "", next);
		}
	};

	/** Waits for the reader to pause, then prices the form if its values are valid. */
	let schedule = () => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (form.checkValidity()) price().catch(() => undefined);
		}, current()?.delay ?? 0);
	};

	form.addEventListener("input", schedule, { signal });
	form.addEventListener("change", schedule, { signal });
	form.addEventListener(
		"submit",
		(event) => {
			if (event.defaultPrevented || carriesValue(event.submitter)) return;
			event.preventDefault();
			clearTimeout(timer);
			price().catch(() => form.submit());
		},
		{ signal },
	);
}

/**
 * The address a GET submission of `form` would load: its action with the fields as the query.
 *
 * @param form The calculator's GET form.
 * @returns The action URL with its query replaced by the form's values.
 */
function addressOf(form: HTMLFormElement): URL {
	let url = new URL(form.action, form.ownerDocument.baseURI);
	let query = new URLSearchParams();
	for (let [name, value] of new FormData(form)) {
		if (typeof value === "string") query.append(name, value);
	}
	url.search = query.toString();
	return url;
}

/**
 * Whether a submit came from a button with its own `name`, such as "Add monitor". Its value is
 * something the fields don't hold and may change which fields the form has, so the page has
 * to render it; Enter, `requestSubmit()` and an unnamed button only re-price.
 *
 * @param submitter The element that submitted the form, if any.
 * @returns `true` when the submit must reach the server as a page load.
 */
function carriesValue(submitter: HTMLElement | null): boolean {
	return (
		(submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) &&
		submitter.name !== ""
	);
}
