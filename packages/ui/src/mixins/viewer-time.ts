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

/**
 * Rewrites the host `<time>` from its own `datetime` once it is live in a document, and after
 * every update around it: the text against the viewer's clock, the date and title in their zone.
 *
 * @example <time dateTime={iso} mix={[viewerTime(locale)]}>{serverText}</time>
 */
export const viewerTime: MixinFactory<HTMLTimeElement, [locale: string | undefined], ElementProps> =
	createMixin<HTMLTimeElement, [locale: string | undefined], ElementProps>(
		(handle) => {
			let locale: string | undefined;

			/** Formats the host's own `datetime` in the viewer's zone, against their clock. */
			function rewrite(node: HTMLTimeElement): void {
				let formatted = formatRelativeTime(node.dateTime, {
					locale,
					timeZone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
				});
				if (!formatted.dateTime) return;
				node.textContent = formatted.text;
				node.title = formatted.title;
			}

			handle.addEventListener("insert", (event) => rewrite(event.node));
			handle.addEventListener("commit", (event) => rewrite(event.node));

			return (next) => {
				locale = next;
				return handle.element;
			};
		},
		{ ssr: false },
	);
