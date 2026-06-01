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
