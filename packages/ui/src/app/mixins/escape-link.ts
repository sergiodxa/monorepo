/**
 * Follows a link when Escape is pressed anywhere on the page, the way "Clear filters [Esc]"
 * resets a list. It listens last: a selection, an open dialog or popover, or a text field
 * each takes Escape first, and the link follows only when none of them did.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { isListKey } from "../utils/key-target.js";

/**
 * Clicks the host `<a>` on an unclaimed Escape, so navigation, prefetch and frame targeting
 * stay the link's own. The listener sits on the document in the bubble phase, which lets any
 * handler that stops the key earlier (a selection bar clearing its rows) keep it.
 *
 * @example <a href={clearHref} mix={[escapeLink()]}>Clear filters</a>
 */
export const escapeLink: MixinFactory<HTMLAnchorElement, []> = createMixin<HTMLAnchorElement, []>(
	(handle) => {
		let controller: AbortController | undefined;

		handle.addEventListener("insert", (event) => {
			controller?.abort();
			controller = new AbortController();
			let link = event.node;
			link.ownerDocument.addEventListener(
				"keydown",
				(key) => {
					if (key.key !== "Escape" || key.shiftKey || !isListKey(key)) return;
					key.preventDefault();
					link.click();
				},
				{ signal: controller.signal },
			);
		});

		handle.addEventListener("remove", () => {
			controller?.abort();
			controller = undefined;
		});
	},
);
