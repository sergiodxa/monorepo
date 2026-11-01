/**
 * Copies a document fetched from a URL onto the clipboard when its host button is pressed,
 * for a "Copy page" button that hands a page's Markdown twin to the reader. It settles with
 * the same `ui:copy` event {@link copyToClipboard} dispatches, so `copyFeedback` confirms it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createElement, createMixin, on } from "remix/component";

import { CopyEvent } from "../../mixins/copy-to-clipboard.js";
import { DISABLED_SELECTOR } from "../../utils/disabled-selector.js";

/** How long a failure message stays in the button's status region. */
const FAILURE_MS = 4000;

/**
 * The body of `href`, or `null` when the request fails or answers with an error status.
 */
async function fetchText(href: string, signal: AbortSignal): Promise<string | null> {
	try {
		let response = await fetch(href, { headers: { accept: "text/markdown, text/plain" }, signal });
		return response.ok ? await response.text() : null;
	} catch {
		return null;
	}
}

/**
 * Writes the body `text` resolves to and reports whether it reached the clipboard. Where
 * `ClipboardItem` exists the write starts within the press and waits for the body, which
 * keeps Safari's user activation alive across the fetch.
 */
async function writeClipboard(text: Promise<string | null>): Promise<boolean> {
	try {
		if (typeof ClipboardItem === "undefined") {
			let body = await text;
			if (body === null) return false;
			await navigator.clipboard.writeText(body);
			return true;
		}

		let blob = text.then((body) =>
			body === null
				? Promise.reject(new Error("The page answered without a body"))
				: new Blob([body], { type: "text/plain" }),
		);
		await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
		return true;
	} catch {
		return false;
	}
}

/**
 * Fetches `href` with `Accept: text/markdown, text/plain` on every press and writes the
 * body to the clipboard, then dispatches a `ui:copy` {@link CopyEvent}. A failed fetch or
 * write writes `failedLabel` into the button's `[role="status"]` element for four seconds.
 *
 * @param href URL of the text to copy, such as the page's `.md` twin.
 * @param failedLabel What a screen reader announces when the copy fails.
 * @returns A mixin descriptor for the copy button's `mix` prop.
 * @example
 * <button type="button" mix={[copyFromUrl("/docs/install.md", t("copyFailed")), copyFeedback(t("copied"))]}>
 * 	{t("copyPage")}
 * 	<span role="status" mix={[visuallyHidden()]} />
 * </button>
 */
export const copyFromUrl: MixinFactory<
	HTMLButtonElement,
	[href: string, failedLabel?: string],
	ElementProps
> = createMixin<HTMLButtonElement, [href: string, failedLabel?: string], ElementProps>((handle) => {
	let timer: ReturnType<typeof setTimeout> | undefined;

	handle.addEventListener("remove", () => clearTimeout(timer));

	return (href, failedLabel) =>
		createElement(handle.element, {
			mix: [
				on<HTMLButtonElement, "click">("click", async (event, signal) => {
					let button = event.currentTarget;
					if (button.matches(DISABLED_SELECTOR)) return;

					let text = fetchText(href, signal);
					let copied = await writeClipboard(text);
					if (signal.aborted) return;

					button.dispatchEvent(new CopyEvent(copied, (await text) ?? ""));
					if (!copied) announceFailure(button, failedLabel);
				}),
			],
		});

	/** Writes the failure into the button's status region, clearing it after a while. */
	function announceFailure(button: HTMLButtonElement, failedLabel: string | undefined): void {
		let status = button.querySelector('[role="status"]');
		if (!status || !failedLabel) return;

		status.textContent = failedLabel;
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (status.textContent === failedLabel) status.textContent = "";
		}, FAILURE_MS);
	}
});
