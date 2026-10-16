/**
 * Default request handler. Renders the 404 document for any request that matches no
 * route, replacing the framework error boundary the site used to fall back to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Renderer } from "remix/middleware/render";
import type { RequestContext } from "remix/router";

import { seo } from "~/app/initializers/seo";
import DocumentLayout from "~/resources/layouts/document";
import NotFoundView from "~/resources/views/not-found";

/**
 * Renders the 404 document for unmatched routes. Takes only the members it reads, since the
 * router infers its context from the very options this handler is passed in.
 */
export default function defaultHandler(
	ctx: Pick<RequestContext, "assets" | "url"> & { render: Renderer<RemixNode> },
) {
	let description = "The requested page could not be found.";

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
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
