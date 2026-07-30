/**
 * Default request handler. Renders the 404 document for any request that matches no
 * route, replacing the framework error boundary the site used to fall back to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/fetch-router";

import { seo } from "~/app/lib/seo";
import DocumentLayout from "~/resources/layouts/document";
import NotFoundView from "~/resources/views/not-found";

/** Renders the 404 document for unmatched routes. */
export default function defaultHandler(ctx: RequestContext) {
	let description = "The requested page could not be found.";

	return ctx.render(
		<DocumentLayout
			title="404"
			description={description}
			canonical={seo.canonical(ctx.url)}
			robots={seo.robotsTag({ index: false, follow: true })}
		>
			<NotFoundView title="404" description={description} />
		</DocumentLayout>,
		{ status: 404 },
	);
}
