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
 * resolved depth, mirroring the contract those components already publish
 * on their own host element. {@link headingLevelFallback} reads this
 * attribute off the nearest ancestor to recover an ambient level it can't
 * reach through context.
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
		 * Called once, on attach, with the ancestor level
		 * {@link headingLevelFallback} recovered from the DOM — clamped to the
		 * native `1`–`6` range. Never called when no ancestor carries
		 * {@link HEADING_LEVEL_ATTRIBUTE}, or when its value is missing or
		 * unparsable. The consuming island stores the reported level and calls
		 * `handle.update()` to re-render with it corrected.
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
 * {@link HEADING_LEVEL_ATTRIBUTE} — so a lookup made from an already-resolved
 * `HeadingScope` or `Heading` root finds the scope wrapping it, never reads
 * back its own value.
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
 * Safety net for an independently-hydrated island whose root `HeadingScope`
 * or `Heading` didn't get its ambient level threaded in explicitly as a
 * `level` prop by whoever rendered the island — the preferred path, and the
 * one every other case should reach for instead of this mixin. On attach,
 * this walks up from its host with `Element.closest()`, searching from the
 * host's own parent when the host itself already carries
 * {@link HEADING_LEVEL_ATTRIBUTE} so the search always lands on the nearest
 * outer scope rather than reading back the host's own value, parses the
 * ancestor's level, clamps it into the native `1`–`6` range, and reports it
 * through `options.onLevel`. It no-ops entirely when no ancestor carries the
 * attribute, or when its value is missing or unparsable.
 *
 * This mixin never owns or applies the level itself — it only detects it and
 * hands it back through `onLevel`, mirroring how other first-party mixins
 * report a detected value or state change back to their consumer instead of
 * applying it directly. The consuming island's own Handle-pattern component
 * stores the reported level in its own state and calls `handle.update()` to
 * re-render its `HeadingScope` or `Heading` root with the corrected `level`
 * prop.
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
