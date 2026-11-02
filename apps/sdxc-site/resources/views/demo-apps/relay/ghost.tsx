/**
 * Text-shaped placeholder bars for Relay's frames: a ghost lays its content out unseen and
 * paints one bar per line it wraps to, so a placeholder takes the exact lines, badges and
 * widths of the part it stands in for at every column width.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";

namespace Ghost {
	export interface Props {
		/** The text or element whose box the bar takes. */
		children: RemixNode;
		/**
		 * Paints one pill around an inline-flex box such as a badge, instead of one bar per
		 * wrapped line of text.
		 */
		box?: boolean;
	}
}

/**
 * Renders its content invisibly under a neutral bar. Text keeps its line breaks and the bar
 * repeats on each line, so a subject that wraps on a phone wraps in its placeholder too.
 */
export function Ghost(handle: Handle<Ghost.Props>) {
	return () => {
		let { children, box = false } = handle.props;
		let display = box ? "inline-flex" : "inline";
		return (
			<span
				data-slot="relay-ghost"
				mix={[
					raw({
						display,
						backgroundColor: "var(--ui-neutral-border)",
						borderRadius: box ? "999px" : "var(--ui-radius-sm, 0.25rem)",
						boxDecorationBreak: "clone",
						WebkitBoxDecorationBreak: "clone",
						userSelect: "none",
					}),
				]}
			>
				<span mix={[raw({ display, visibility: "hidden" })]}>{children}</span>
			</span>
		);
	};
}
