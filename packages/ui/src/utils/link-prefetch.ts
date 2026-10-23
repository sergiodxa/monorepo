/**
 * The prefetch modes every link component accepts, and the attribute value
 * each mode writes, so `Link`, `NavLink`, `Pagination.Link` and the rest
 * prefetch their destinations through one shared contract.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * When a link's destination starts loading. `"intent"` and `"viewport"` hand
 * the decision to the `remix/component` runtime through `data-rmx-prefetch`;
 * `"render"` asks the browser through a `<link rel="prefetch">` rendered
 * beside the anchor, which also serves full-document navigations; `"none"`
 * loads it only on navigation.
 */
export type LinkPrefetch = "none" | "intent" | "viewport" | "render";

/**
 * Value for the anchor's `data-rmx-prefetch` attribute, present only for the
 * modes the runtime reads.
 *
 * @param mode The link's prefetch mode.
 * @returns `"intent"` or `"viewport"`, or `undefined` to leave the attribute off.
 */
export function prefetchAttribute(mode: LinkPrefetch) {
	if (mode === "intent" || mode === "viewport") return mode;
	return undefined;
}

/**
 * Whether the link renders a `<link rel="prefetch">` for its destination,
 * which needs both the `"render"` mode and a destination to point at.
 *
 * @param mode The link's prefetch mode.
 * @param href The anchor's destination.
 * @returns `true` when the hint belongs beside the anchor.
 */
export function rendersPrefetchHint(mode: LinkPrefetch, href: unknown): href is string {
	return mode === "render" && typeof href === "string" && href.length > 0;
}
