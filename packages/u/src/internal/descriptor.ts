/**
 * The shared utility mixin descriptor every public utility in this package is
 * built from. A utility mixin is a real `remix/ui` host-element mixin — it
 * works directly in a `mix` prop and dedupes through `css()`'s own class
 * cache — but it also carries a hidden style tree behind the {@link UTILITY}
 * symbol so wrapper utilities such as `hover()`, `at()`, and `media()` can
 * read what an atomic utility would render, nest it under a selector or
 * at-rule, and re-emit it as a new utility mixin of their own. Plain `css()`
 * mixins can't do this: once built, their generated class name is opaque.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/ui";

import { css } from "remix/ui";

import type { CSSStyles } from "./css-styles";

/**
 * Private symbol keying the style-tree metadata carried by every utility
 * mixin. Not exported outside `internal/` — call sites read a utility's
 * styles through {@link compose}, never by reaching for this symbol
 * themselves.
 */
const UTILITY = Symbol("utility");

/**
 * The metadata a utility mixin carries behind {@link UTILITY}: a thunk that
 * rebuilds its style tree on demand, so wrapper utilities can pull it,
 * merge it with siblings, and nest the result under their own selector or
 * at-rule before handing it back to `css()`.
 */
export interface UtilityNode {
	toStyles(): CSSStyles;
}

/**
 * A `remix/ui` host-element mixin produced by this package. Valid anywhere a
 * plain `css()` mixin is valid in a `mix` prop, plus inspectable by wrapper
 * utilities through its hidden {@link UTILITY} metadata.
 */
export type UtilityMixin<Node extends Element = Element> = MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> & {
	readonly [UTILITY]: UtilityNode;
};

/**
 * Accepted input shape for any utility call site that composes other
 * utilities: a single utility mixin, a falsy value (dropped), or a
 * recursively nested array of the same — matching what `mix` itself accepts,
 * so `u.hover([u.bg("brand.tint"), false, [u.border("brand")]])` flattens the
 * same way a `mix` array would.
 */
export type UtilityInput<Node extends Element = Element> =
	| UtilityMixin<Node>
	| null
	| undefined
	| false
	| 0
	| ""
	| ReadonlyArray<UtilityInput<Node>>;

/**
 * Builds a utility mixin from a style-tree thunk. Every atomic and semantic
 * utility in this package returns the result of this function — never a bare
 * `css()` mixin — so it stays inspectable by wrapper utilities.
 *
 * @example
 * export function p(...values: SpacingValue[]) {
 *   return utility(() => ({ padding: resolvePadding(values) }));
 * }
 */
export function utility<Node extends Element = Element>(
	toStyles: () => CSSStyles,
): UtilityMixin<Node> {
	let descriptor = css<Node>(toStyles()) as UtilityMixin<Node>;
	let node: UtilityNode = { toStyles };
	Object.defineProperty(descriptor, UTILITY, { value: node, enumerable: false });
	return descriptor;
}

/**
 * Recursively flattens a wrapper utility's input into a flat list of utility
 * mixins, dropping falsy values, the same way `mix` flattens nested arrays.
 */
export function flatten<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node>[] {
	if (!input) return [];
	if (Array.isArray(input)) return input.flatMap((item) => flatten<Node>(item));
	return [input as UtilityMixin<Node>];
}

function isPlainStyleObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Merges style trees left to right. A plain declaration is overwritten by
 * the same key in a later tree ("the later utility wins"); a nested selector
 * or at-rule block present in more than one tree is merged recursively
 * instead of replaced, so `u.hover([u.bg("brand.tint"), u.border("brand")])`
 * combines both utilities' `&:hover` blocks into one instead of the second
 * replacing the first.
 */
export function merge(...trees: CSSStyles[]): CSSStyles {
	let result: Record<string, unknown> = {};
	for (let tree of trees) {
		for (let [key, value] of Object.entries(tree as Record<string, unknown>)) {
			let existing = result[key];
			result[key] =
				isPlainStyleObject(existing) && isPlainStyleObject(value)
					? merge(existing as CSSStyles, value as CSSStyles)
					: value;
		}
	}
	return result as CSSStyles;
}

/**
 * Nests `styles` under a single computed selector or at-rule key. A plain
 * `{ [key]: styles }` object literal doesn't satisfy `CSSStyles`'s index
 * signature when `key` is a runtime string rather than a literal, so every
 * wrapper builds its nested block through this helper instead.
 */
export function nest(key: string, styles: CSSStyles): CSSStyles {
	let result: Record<string, CSSStyles> = {};
	result[key] = styles;
	return result as CSSStyles;
}

/**
 * The shared implementation behind every selector, media, container, and
 * feature-query wrapper: flattens `input`, merges the flattened utilities'
 * style trees, passes the merged tree through `wrap` to nest it under the
 * wrapper's own selector or at-rule, and returns the result as a new,
 * equally inspectable utility mixin — so wrappers compose with each other
 * (`u.at("md", [u.p(4), u.hover(u.p(6))])`).
 *
 * @example
 * export function hover(input: UtilityInput) {
 *   return compose(input, (styles) => ({ "&:hover": styles }));
 * }
 */
export function compose<Node extends Element = Element>(
	input: UtilityInput<Node>,
	wrap: (styles: CSSStyles) => CSSStyles,
): UtilityMixin<Node> {
	let mixins = flatten<Node>(input);
	return utility<Node>(() => wrap(merge(...mixins.map((mixin) => mixin[UTILITY].toStyles()))));
}
