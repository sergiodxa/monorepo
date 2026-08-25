/**
 * Why JS: recovering an ambient level across an independently-hydrated
 * island requires reading the DOM, which pure components cannot do.
 * No-JS baseline: the server-rendered tag, computed from the real ambient
 * level during SSR, is already correct and is what stays on the page if
 * this mixin never runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/ui";

import { createMixin, ref } from "remix/ui";

import type { HeadingLevel } from "../components/heading-scope";

/**
 * Attribute every resolved `HeadingScope` and `Heading` carries with its own
 * resolved depth. {@link headingLevelFallback} reads it off the nearest
 * ancestor to recover an ambient level it can't reach through context.
 */
const HEADING_LEVEL_ATTRIBUTE = "data-heading-level";

/** Shallowest semantic depth the native heading elements support; a reading below this clamps up to it. */
const MIN_LEVEL = 1;

/** Deepest semantic depth the native heading elements support; a reading past this clamps down to it. */
const MAX_LEVEL = 6;

/**
 * Types associated with {@link headingLevelFallback}.
 */
export namespace HeadingLevelFallback {
	/**
	 * Configuration accepted by {@link headingLevelFallback}.
	 */
	export interface Options {
		/**
		 * Called once, on attach, with the ancestor level clamped to the native
		 * `1`–`6` range. Never called when no ancestor carries
		 * {@link HEADING_LEVEL_ATTRIBUTE} or its value is unparsable.
		 */
		onLevel: (level: HeadingLevel) => void;
	}
}

/**
 * Clamps `value` into the native `1`–`6` heading range.
 *
 * @param value Parsed integer to clamp.
 * @returns `value` unchanged where it already sits in range, otherwise the nearest bound.
 */
function clampLevel(value: number): HeadingLevel {
	return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, value)) as HeadingLevel;
}

/**
 * Reads the nearest ancestor's resolved heading level off the DOM, searching
 * upward from `node`'s parent when `node` itself already carries
 * {@link HEADING_LEVEL_ATTRIBUTE}, so it finds the scope wrapping `node`.
 *
 * @param node Element to search upward from.
 * @returns The nearest ancestor's clamped level, or `undefined` where no
 * ancestor carries the attribute at all, or where its value is missing or
 * unparsable.
 */
function readAncestorLevel(node: Element): HeadingLevel | undefined {
	let searchRoot = node.hasAttribute(HEADING_LEVEL_ATTRIBUTE) ? node.parentElement : node;
	if (!searchRoot) return undefined;

	let ancestor = searchRoot.closest(`[${HEADING_LEVEL_ATTRIBUTE}]`);
	if (!ancestor) return undefined;

	let raw = ancestor.getAttribute(HEADING_LEVEL_ATTRIBUTE);
	if (raw === null) return undefined;

	let parsed = Number.parseInt(raw, 10);
	if (Number.isNaN(parsed)) return undefined;

	return clampLevel(parsed);
}

/**
 * Safety net for an independently-hydrated island whose root didn't get its
 * ambient level threaded in as a `level` prop. Detects the nearest
 * ancestor's resolved level and reports it through `options.onLevel`.
 *
 * @param options Callback the recovered level is reported through; see {@link HeadingLevelFallback.Options}.
 * @returns A mixin descriptor for an island's outermost `HeadingScope` or `Heading` root's `mix` prop.
 * @example
 * // An island whose root is a HeadingScope wrapping further content.
 * function CommentsIsland(handle: Handle) {
 * 	let level: HeadingLevel | undefined;
 *
 * 	return () => (
 * 		<HeadingScope
 * 			level={level}
 * 			mix={[
 * 				headingLevelFallback({
 * 					onLevel(detected) {
 * 						level = detected;
 * 						handle.update();
 * 					},
 * 				}),
 * 			]}
 * 		>
 * 			<Heading>Comments</Heading>
 * 		</HeadingScope>
 * 	);
 * }
 * @example
 * // An island whose root is a lone Heading.
 * function SectionTitleIsland(handle: Handle) {
 * 	let level: HeadingLevel | undefined;
 *
 * 	return () => (
 * 		<Heading
 * 			level={level}
 * 			mix={[
 * 				headingLevelFallback({
 * 					onLevel(detected) {
 * 						level = detected;
 * 						handle.update();
 * 					},
 * 				}),
 * 			]}
 * 		>
 * 			Related articles
 * 		</Heading>
 * 	);
 * }
 */
export const headingLevelFallback: MixinFactory<
	HTMLElement,
	[options: HeadingLevelFallback.Options],
	ElementProps
> = createMixin<HTMLElement, [options: HeadingLevelFallback.Options], ElementProps>((_handle) => {
	return (options) =>
		ref((host) => {
			let level = readAncestorLevel(host);
			if (level !== undefined) options.onLevel(level);
		});
});
