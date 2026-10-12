/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BlurName } from "../types.js";

import { backdropBlur } from "../effects/backdrop-blur.js";
import { var as varUtility } from "../general/var.js";
import { compose } from "../internal/descriptor.js";
import { media } from "../responsive/media.js";

import { bg } from "./bg.js";
import { colorMix } from "./color-mix.js";

/**
 * A see-through background plus backdrop blur, gated behind
 * `prefers-reduced-transparency: no-preference`; a reduced-transparency
 * preference gets the opaque `--ui-bg` background and stays legible.
 *
 * @example u.translucent("sm")
 * @example css({ backgroundColor: "var(--ui-bg, Canvas)", "@media (prefers-reduced-transparency: no-preference)": { backgroundColor: "color-mix(in oklab, var(--ui-bg, Canvas) 70%, transparent)", "--ui-backdrop-blur": "var(--ui-blur-sm, 4px)", backdropFilter: "blur(var(--ui-backdrop-blur, 0px)) ..." } })
 */
export function translucent<Node extends Element = Element>(name: BlurName | (string & {}) = "md") {
	let seeThrough = bg<Node>(
		colorMix("oklab", { color: varUtility("ui-bg", "Canvas"), weight: 70 }, "transparent"),
	);
	let gated = media<Node>("(prefers-reduced-transparency: no-preference)", [
		seeThrough,
		backdropBlur<Node>(name),
	]);
	return compose<Node>([bg<Node>(), gated], (styles) => styles);
}
