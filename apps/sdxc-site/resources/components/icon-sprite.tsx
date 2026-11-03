/**
 * Every `@sdxc/icons` icon as a `<symbol>` in one SVG document, which the gallery's tiles
 * draw through `<use>`. Each symbol holds the icon exactly as its component renders it, so
 * the gallery and the package can never draw an icon differently.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Icon } from "@sdxc/icons";

import { listIcons } from "~/app/services/icons";

/**
 * Draws the sprite. A symbol's stroke and stroke width inherit from the `<use>` that draws
 * it, so a tile's own `stroke` and `stroke-width`, or CSS on the tile, restyle the icon.
 */
export default function IconSprite() {
	return () => (
		<svg xmlns="http://www.w3.org/2000/svg">
			{listIcons().map((icon) => (
				<symbol key={icon.name} id={icon.name} viewBox="0 0 24 24">
					<Icon name={icon.name} color="inherit" strokeWidth="inherit" />
				</symbol>
			))}
		</svg>
	);
}
