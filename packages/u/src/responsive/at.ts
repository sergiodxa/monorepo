/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";
import type { ContainerName } from "../types";

import { compose, nest } from "../internal/descriptor";
import { container } from "../internal/tokens";

/**
 * A container query, never a viewport media query — the nearest ancestor
 * with `container-type: inline-size` (or `container-type: size`) is what
 * `size` is compared against, so a component embedded in a narrow column
 * adapts to that column's width instead of the page's. Called with a third
 * argument, `name` targets a specific named container — established on an
 * ancestor via `container-name` or the `container` shorthand (e.g.
 * `container: sidebar / inline-size`) — instead of whichever one is
 * nearest; useful once more than one ancestor establishes a container and
 * a query needs to skip past the closest one.
 *
 * @example u.at("md", [u.p(6), u.hstack({ gap: 4 })])
 * @example css({ "@container (min-width: var(--ui-container-md, 36rem))": { padding: "...", display: "flex" } })
 * @example u.at("md", "sidebar", u.p(6))
 * @example css({ "@container sidebar (min-width: var(--ui-container-md, 36rem))": { padding: "..." } })
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
	nameOrInput: string | UtilityInput<Node>,
	maybeInput?: UtilityInput<Node>,
): UtilityMixin<Node> {
	let name = typeof nameOrInput === "string" ? nameOrInput : undefined;
	let input = typeof nameOrInput === "string" ? maybeInput : nameOrInput;
	let condition = `(min-width: ${container(size)})`;
	let query = name ? `${name} ${condition}` : condition;
	return compose(input, (styles) => nest(`@container ${query}`, styles));
}

/**
 * The `max-width` counterpart to {@link at}: applies the given utilities
 * while the nearest container's inline size is at most `size`, instead of
 * at least. Same named-scale/literal-length resolution and optional
 * container-name targeting as {@link at}.
 *
 * @example u.atMax("md", [u.p(2), u.flexCol()])
 * @example css({ "@container (max-width: var(--ui-container-md, 36rem))": { padding: "...", flexDirection: "column" } })
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
	nameOrInput: string | UtilityInput<Node>,
	maybeInput?: UtilityInput<Node>,
): UtilityMixin<Node> {
	let name = typeof nameOrInput === "string" ? nameOrInput : undefined;
	let input = typeof nameOrInput === "string" ? maybeInput : nameOrInput;
	let condition = `(max-width: ${container(size)})`;
	let query = name ? `${name} ${condition}` : condition;
	return compose(input, (styles) => nest(`@container ${query}`, styles));
}
