/**
 * The shared utility mixin descriptor every public utility in this package is
 * built from. A utility mixin works directly in a `mix` prop and dedupes
 * through `css()`'s class cache, and it also carries a hidden style tree
 * behind the {@link UTILITY} symbol so wrappers like `hover()` and `at()` can
 * read what it renders, nest that under a selector, and re-emit it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/ui";

import { css } from "remix/ui";

import type { CSSStyles } from "./css-styles.js";

/**
 * Private symbol keying the style-tree metadata carried by every utility
 * mixin. Call sites read a utility's styles through {@link compose}.
 */
const UTILITY = Symbol("utility");

/**
 * The metadata a utility mixin carries behind {@link UTILITY}: a thunk that
 * rebuilds its style tree on demand, so wrappers can merge it with siblings
 * and nest the result under their own selector before handing it to `css()`.
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
 * Accepted input for any utility that composes other utilities: a single
 * utility mixin, a falsy value (dropped), or a recursively nested array of the
 * same, so it flattens exactly the way a `mix` array does.
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
 * utility in this package returns the result of this function, which is what
 * keeps them all inspectable by wrapper utilities.
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
	if (Array.isArray(input)) {
		return (input as ReadonlyArray<UtilityInput<Node>>).flatMap((item) => flatten<Node>(item));
	}
	return [input as UtilityMixin<Node>];
}

function isPlainStyleObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Merges style trees left to right: for a plain declaration the later tree
 * wins, while a nested selector or at-rule block present in more than one tree
 * merges recursively, combining sibling `&:hover` blocks into one.
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
 * Nests `styles` under a single computed selector or at-rule key. Building the
 * block through a `Record` keeps a runtime string key assignable to
 * `CSSStyles`'s index signature, so every wrapper goes through this helper.
 */
export function nest(key: string, styles: CSSStyles): CSSStyles {
	let result: Record<string, CSSStyles> = {};
	result[key] = styles;
	return result as CSSStyles;
}

/**
 * The shared implementation behind every selector, media, container, and
 * feature-query wrapper: flattens and merges `input`, nests the tree through
 * `wrap`, and returns an equally inspectable mixin, so wrappers compose.
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
