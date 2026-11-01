/**
 * Why JS: a server cannot know the viewer's time zone or clock, so a relative time it renders
 * names the server's zone. No-JS baseline: the server's text and title stand, readable and
 * correct in the zone they name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { formatRelativeTime } from "../utils/relative-time.js";

/** Arguments of {@link viewerTime}: the locale, then the reference moment the text counts from. */
type ViewerTimeArgs = [locale: string | undefined, now?: string | number];

/**
 * Rewrites the host `<time>` from its own `datetime` once it is live in a document, and after
 * every update around it: the date and title in the viewer's zone, the text against `now` when
 * given and the viewer's clock otherwise, so a fixed reference reads the same on every machine.
 *
 * @example <time dateTime={iso} mix={[viewerTime(locale, now)]}>{serverText}</time>
 */
export const viewerTime: MixinFactory<HTMLTimeElement, ViewerTimeArgs, ElementProps> = createMixin<
	HTMLTimeElement,
	ViewerTimeArgs,
	ElementProps
>(
	(handle) => {
		let locale: string | undefined;
		let now: string | number | undefined;

		/** Formats the host's own `datetime` in the viewer's zone, against `now` or their clock. */
		function rewrite(node: HTMLTimeElement): void {
			let formatted = formatRelativeTime(node.dateTime, {
				now,
				locale,
				timeZone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
			});
			if (!formatted.dateTime) return;
			node.textContent = formatted.text;
			node.title = formatted.title;
		}

		handle.addEventListener("insert", (event) => rewrite(event.node));
		handle.addEventListener("commit", (event) => rewrite(event.node));

		return (nextLocale, nextNow) => {
			locale = nextLocale;
			now = nextNow;
			return handle.element;
		};
	},
	{ ssr: false },
);
