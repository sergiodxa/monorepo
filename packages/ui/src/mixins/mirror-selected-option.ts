/**
 * Keeps a `<selectedcontent>` slot showing the option a `<select>` has
 * selected, restoring the mirror the browser maintains whenever a re-render
 * of the tree the field sits in clears it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createMixin } from "remix/ui";

/**
 * Writes the selected `<option>`'s content back into the host
 * `<selectedcontent>` once a render has committed and left the slot empty.
 *
 * The platform fills the slot from the selected option, so what it holds belongs
 * to the browser rather than to the tree the field was rendered in. A re-render of
 * that tree finds content nobody declared and empties the slot, which leaves the
 * trigger blank until the next choice is made; writing the option back on commit is
 * what keeps the two agreeing. A slot holding a consumer's own fallback content is
 * left alone, since that content is the tree's to own.
 *
 * @example
 * <selectedcontent mix={[mirrorSelectedOption()]} />
 */
export const mirrorSelectedOption: MixinFactory<HTMLElement> = createMixin<HTMLElement>(
	(handle) => {
		handle.addEventListener("commit", (event) => {
			let slot = event.node;
			if (slot.hasChildNodes()) return;

			let option = slot.closest("select")?.selectedOptions[0];
			if (!option) return;

			for (let child of option.childNodes) slot.appendChild(child.cloneNode(true));
		});

		return () => {};
	},
);
