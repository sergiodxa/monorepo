/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The side of the anchor whose position is being read. The physical sides
 * (`"top"`, `"right"`, `"bottom"`, `"left"`) name a fixed edge; the logical
 * ones resolve against a writing mode — `"start"`/`"end"` against the
 * anchor's containing block, `"self-start"`/`"self-end"` against the
 * positioned element's own. `"center"` is the midpoint between the two edges
 * on the relevant axis, and `"inside"`/`"outside"` name the edge nearest to
 * or furthest from the inset property being set, so the same declaration
 * flips as the placement does. The `(string & {})` member keeps the type a
 * plain string so a percentage along that axis (`"25%"`) is accepted too.
 */
export type AnchorSide =
	| "top"
	| "right"
	| "bottom"
	| "left"
	| "start"
	| "end"
	| "self-start"
	| "self-end"
	| "center"
	| "inside"
	| "outside"
	| (string & {});

/**
 * Resolves a CSS Anchor Positioning `anchor()` reference:
 * `anchor(--{name} {side})`, or `anchor(--{name} {side}, {fallback})` when a
 * fallback is given. A plain string resolver, not a mixin — use it anywhere a
 * utility accepts a raw CSS value, which in practice means an inset utility.
 *
 * This is the value function that reads an anchor's *geometry*, and it
 * completes the anchor-positioning set. `u.anchorName()` declares an anchor
 * and `u.positionAnchor()` points at one, and with both in place
 * `u.positionArea()` can drop the positioned element into a named region of
 * the 3x3 grid around that anchor — but a region is as precise as it gets.
 * Saying "my block-start edge sits exactly at the anchor's block-end edge"
 * takes an inset, and an inset needs a length, which is what this returns:
 * `u.insBs(u.anchor("tip", "bottom"))`.
 *
 * The leading `--` is prepended for you, matching `u.anchorName()` and
 * `u.positionAnchor()`, and the `u.var()`/`u.vars()` convention they in turn
 * follow — an anchor name is a dashed-ident just like a custom property.
 *
 * Only valid on a positioned element whose `position-anchor` actually
 * resolves to an anchor. When it doesn't — no such anchor name in scope, or
 * the referenced element isn't an acceptable anchor — the whole declaration
 * is invalid at computed-value time and the inset falls back to `auto`. The
 * `fallback` argument is what avoids that: it is the length used in place of
 * the anchor's position, so the declaration stays valid either way.
 *
 * @example u.insBs(u.anchor("tip", "bottom"))
 * @example "anchor(--tip bottom)"
 * @example u.anchor("menu-button", "self-end")
 * @example "anchor(--menu-button self-end)"
 * @example u.anchor("tip", "bottom", "100%")
 * @example "anchor(--tip bottom, 100%)"
 * @example u.anchor("sidebar", "center", "0px")
 * @example "anchor(--sidebar center, 0px)"
 */
export function anchor(name: string, side: AnchorSide, fallback?: string): string {
	return fallback === undefined
		? `anchor(--${name} ${side})`
		: `anchor(--${name} ${side}, ${fallback})`;
}
