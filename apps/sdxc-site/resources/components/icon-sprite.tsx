/**
 * Every `@sdxc/icons` icon as a `<symbol>` in one hidden `<svg>`, rendered once in the
 * gallery page so its tiles draw through `<use>` with no request of their own. Each symbol
 * holds the icon exactly as its component renders it, so the two never draw it differently.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IconName } from "@sdxc/icons";

import { Icon } from "@sdxc/icons";

import { listIcons } from "~/app/services/icons";

/**
 * What every symbol's id starts with, so an icon's id never collides with an element the
 * page already names, such as a `search` or `menu` landmark.
 */
const SYMBOL_PREFIX = "lucide-";

/** The fragment a `<use>` names to draw `name` from the page's symbols. */
export function iconSymbolHref(name: IconName): string {
	return `#${SYMBOL_PREFIX}${name}`;
}

/**
 * Draws the symbols, out of the layout and the accessibility tree. A symbol's stroke and
 * stroke width inherit from the `<use>` that draws it, so CSS on a tile restyles the icon.
 */
export default function IconSprite() {
	return () => (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
			width="0"
			height="0"
			style={{ position: "absolute", overflow: "hidden" }}
		>
			{listIcons().map((icon) => (
				<symbol key={icon.name} id={`${SYMBOL_PREFIX}${icon.name}`} viewBox="0 0 24 24">
					<Icon name={icon.name} color="inherit" strokeWidth="inherit" />
				</symbol>
			))}
		</svg>
	);
}
