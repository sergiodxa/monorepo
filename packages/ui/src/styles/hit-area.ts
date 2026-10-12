/**
 * The `hitArea()` style-mixin factory: an invisible `::after` box that grows
 * a small control's pointer target to `--ui-target-size` on every side it
 * falls short, keeping the visible control at its designed size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinDescriptor } from "remix/component";

import { combine, pseudoContent } from "@sdxc/u/general";
import { absolute, inset } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";
import { after } from "@sdxc/u/state";

import type { CSSStyles } from "../utils/css-styles.js";

/**
 * Minimum pointer target edge: WCAG 2.5.8's 24px by default, raised to 44px
 * for coarse pointers by the theme, and overridable per app or per subtree.
 */
const TARGET_SIZE = "var(--ui-target-size, 1.5rem)";

/**
 * Options accepted by {@link hitArea}.
 */
export interface HitAreaOptions {
	/**
	 * How the box finds its host. `"inset"` stretches it from the host's edges and needs a
	 * positioned host; `"flex-center"` draws a fixed target-size box that a flex host
	 * centres on its content, so it works however a consumer positions the host.
	 *
	 * @default "inset"
	 */
	anchor?: "inset" | "flex-center";
}

/**
 * Extends the host's pointer target to at least `--ui-target-size` in both axes, centred
 * on the host. With the default `"inset"` anchor each inset is clamped at zero, so a host
 * larger than the target keeps its own box, and the host must be `relative()`/`absolute()`.
 *
 * @param options How the box anchors to its host.
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <button mix={[relative(), hitArea()]} aria-label={t("actions.remove")}><XIcon /></button>
 * @example
 * <button mix={[inlineFlex(), items("center"), justify("center"), hitArea({ anchor: "flex-center" })]} />
 */
export function hitArea<Node extends Element = Element>(
	options: HitAreaOptions = {},
): MixinDescriptor<Node, [styles: CSSStyles], ElementProps> {
	if (options.anchor === "flex-center") {
		return combine<Node>([
			after<Node>([
				pseudoContent<Node>('""'),
				absolute<Node>(),
				is<Node>(TARGET_SIZE),
				bs<Node>(TARGET_SIZE),
			]),
		]);
	}

	return combine<Node>([
		after<Node>([
			pseudoContent<Node>('""'),
			absolute<Node>(),
			inset<Node>(`min(0px, calc((100% - ${TARGET_SIZE}) / 2))`),
		]),
	]);
}
