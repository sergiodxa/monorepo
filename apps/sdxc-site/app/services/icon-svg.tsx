/**
 * One icon's SVG source, as a reader copies it into markup that has no `@sdxc/icons`: the
 * component's own output, laid out one element per line so it reads like hand-written SVG.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IconName } from "@sdxc/icons";

import { Icon } from "@sdxc/icons";
import { renderToString } from "remix/component/server";

/**
 * The icon as `<HeartIcon />` renders it by default, with each empty element self-closed
 * and on its own indented line. Lucide's drawings are a flat list of shapes inside the
 * `<svg>`, so one level of indentation covers every icon.
 */
export async function renderIconSvg(name: IconName): Promise<string> {
	let markup = await renderToString(<Icon name={name} />);
	return markup
		.replace(/<(\w+)([^>]*)><\/\1>/g, "<$1$2 />")
		.replace(/></g, ">\n\t<")
		.replace(/\n\t<\/svg>$/, "\n</svg>");
}
