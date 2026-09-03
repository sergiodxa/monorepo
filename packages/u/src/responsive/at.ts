/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";
import type { ContainerName } from "../types.js";

import { compose, nest } from "../internal/descriptor.js";
import { containerLength } from "../internal/tokens.js";

/**
 * `size` compares against the nearest ancestor with `container-type` set.
 * A named step resolves here to a literal length, since at-rule
 * conditions evaluate before custom properties resolve.
 *
 * @example u.at("md", [u.p(6), u.hstack({ gap: 4 })])
 * @example css({ "@container (min-width: 36rem)": { padding: "...", display: "flex" } })
 * @example u.at("md", "sidebar", u.p(6))
 * @example css({ "@container sidebar (min-width: 36rem)": { padding: "..." } })
 */
export function at<Node extends Element = Element>(
	size: ContainerName | (string & {}),
	input: UtilityInput<Node>,
): UtilityMixin<Node>;
export function at<Node extends Element = Element>(
	size: ContainerName | (string & {}),
	name: string,
	input: UtilityInput<Node>,
): UtilityMixin<Node>;
export function at<Node extends Element = Element>(
	size: ContainerName | (string & {}),
	nameOrInput: string | Exclude<UtilityInput<Node>, "">,
	maybeInput?: UtilityInput<Node>,
): UtilityMixin<Node> {
	let name = typeof nameOrInput === "string" ? nameOrInput : undefined;
	let input = typeof nameOrInput === "string" ? maybeInput : nameOrInput;
	let condition = `(min-width: ${containerLength(size)})`;
	let query = name ? `${name} ${condition}` : condition;
	return compose(input, (styles) => nest(`@container ${query}`, styles));
}

/**
 * The `max-width` counterpart to {@link at}: applies while the nearest
 * container's inline size is at most `size`. Shares {@link at}'s
 * named-scale/literal-length resolution and named-container targeting.
 *
 * @example u.atMax("md", [u.p(2), u.flexCol()])
 * @example css({ "@container (max-width: 36rem)": { padding: "...", flexDirection: "column" } })
 * @example u.atMax("40rem", "ui-dialog", u.flexCol())
 * @example css({ "@container ui-dialog (max-width: 40rem)": { flexDirection: "column" } })
 */
export function atMax<Node extends Element = Element>(
	size: ContainerName | (string & {}),
	input: UtilityInput<Node>,
): UtilityMixin<Node>;
export function atMax<Node extends Element = Element>(
	size: ContainerName | (string & {}),
	name: string,
	input: UtilityInput<Node>,
): UtilityMixin<Node>;
export function atMax<Node extends Element = Element>(
	size: ContainerName | (string & {}),
	nameOrInput: string | Exclude<UtilityInput<Node>, "">,
	maybeInput?: UtilityInput<Node>,
): UtilityMixin<Node> {
	let name = typeof nameOrInput === "string" ? nameOrInput : undefined;
	let input = typeof nameOrInput === "string" ? maybeInput : nameOrInput;
	let condition = `(max-width: ${containerLength(size)})`;
	let query = name ? `${name} ${condition}` : condition;
	return compose(input, (styles) => nest(`@container ${query}`, styles));
}
