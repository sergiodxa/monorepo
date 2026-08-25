/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BlurName } from "../types";

import { backdropBlur } from "../effects/backdrop-blur";
import { compose } from "../internal/descriptor";
import { media } from "../responsive/media";

import { bg } from "./bg";

/**
 * A solid background plus backdrop blur, gated behind
 * `prefers-reduced-transparency: no-preference` so a reduced-transparency
 * preference keeps the plain solid background and stays legible.
 *
 * @example u.translucent("sm")
 * @example css({ backgroundColor: "var(--ui-bg, Canvas)", "@media (prefers-reduced-transparency: no-preference)": { "--ui-backdrop-blur": "var(--ui-blur-sm, 4px)", backdropFilter: "blur(var(--ui-backdrop-blur, 0px)) ...", WebkitBackdropFilter: "blur(var(--ui-backdrop-blur, 0px)) ..." } })
 */
export function translucent<Node extends Element = Element>(name: BlurName | (string & {}) = "md") {
	let gatedBlur = media<Node>(
		"(prefers-reduced-transparency: no-preference)",
		backdropBlur<Node>(name),
	);
	return compose<Node>([bg<Node>(), gatedBlur], (styles) => styles);
}
