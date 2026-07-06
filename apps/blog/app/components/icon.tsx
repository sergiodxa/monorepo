/**
 * Icon component for the blog app. Renders an SVG that references a symbol from
 * the bundled icon sprite via <use>, and exports the sprite href plus the list
 * of valid icon names and an IconName type. This gives the app a single,
 * type-safe way to render its shared iconography.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { type SVGProps } from "react";

import href from "./icon.svg";
export { href };

export default function Icon({ icon, ...props }: SVGProps<SVGSVGElement> & { icon: IconName }) {
	return (
		<svg {...props}>
			<use href={`${href}#${icon}`} />
		</svg>
	);
}

export const iconNames = ["book", "bookmark", "document", "markdown", "pencil"] as const;
export type IconName = (typeof iconNames)[number];
