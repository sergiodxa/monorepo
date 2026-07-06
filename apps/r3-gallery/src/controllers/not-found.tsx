/**
 * Not-found controller for the gallery, used as the router's default element for
 * unmatched URLs. It renders a state message that reports which pathname failed to
 * match, giving visitors a clear fallback when no route applies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/ui";

import { StateMessage } from "../views/state-message";

/**
 * Renders the fallback route state for unmatched URLs.
 *
 * @param ctx Current not-found router context.
 * @returns Not-found route UI.
 */
export function renderNotFound(ctx: { url: URL }): RemixNode {
	return <StateMessage title="Route not found" message={`No route matched ${ctx.url.pathname}.`} />;
}
