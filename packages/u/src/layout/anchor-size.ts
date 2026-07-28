/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Which of the anchor's dimensions is being measured. Prefer the logical
 * `"block"`/`"inline"` over the physical `"width"`/`"height"`, as the rest of
 * this package does, so the measurement follows the writing mode instead of
 * assuming a horizontal one. `"block"`/`"inline"` resolve against the
 * *anchor's* writing mode; `"self-block"`/`"self-inline"` resolve against the
 * positioned element's own, which matters only when the two differ. The
 * `(string & {})` member keeps the type a plain string for anything the
 * keyword set doesn't cover.
 */
export type AnchorSizeDimension =
	| "block"
	| "inline"
	| "self-block"
	| "self-inline"
	| "width"
	| "height"
	| (string & {});

/**
 * Resolves a CSS Anchor Positioning `anchor-size()` reference:
 * `anchor-size(--{name} {dimension})`, or
 * `anchor-size(--{name} {dimension}, {fallback})` when a fallback is given. A
 * plain string resolver, not a mixin — use it anywhere a utility accepts a raw
 * CSS value.
 *
 * The case this exists for is the dropdown or tooltip that has to match the
 * width of the trigger it hangs off. Measuring the trigger and writing the
 * result back has always needed JavaScript, plus a resize observer to keep it
 * correct; this collapses the whole thing into one declaration the browser
 * maintains itself — `u.minIs(u.anchorSize("trigger", "inline"))` for a panel
 * at least as wide as its trigger, or `u.is(...)` to match it exactly.
 *
 * The leading `--` is prepended for you, matching `u.anchorName()` and
 * `u.positionAnchor()`, and the `u.var()`/`u.vars()` convention they follow.
 *
 * Only valid on a positioned element whose `position-anchor` resolves to an
 * anchor; when it doesn't, the declaration is invalid at computed-value time
 * unless a `fallback` length is supplied, which is what keeps it valid.
 *
 * @example u.minIs(u.anchorSize("trigger", "inline"))
 * @example "anchor-size(--trigger inline)"
 * @example u.anchorSize("trigger", "block")
 * @example "anchor-size(--trigger block)"
 * @example u.anchorSize("trigger", "self-inline")
 * @example "anchor-size(--trigger self-inline)"
 * @example u.anchorSize("trigger", "inline", "12rem")
 * @example "anchor-size(--trigger inline, 12rem)"
 */
export function anchorSize(
	name: string,
	dimension: AnchorSizeDimension,
	fallback?: string,
): string {
	return fallback === undefined
		? `anchor-size(--${name} ${dimension})`
		: `anchor-size(--${name} ${dimension}, ${fallback})`;
}
