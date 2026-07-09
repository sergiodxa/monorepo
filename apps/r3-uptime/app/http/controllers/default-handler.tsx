/**
 * Default request handler for the r3-uptime router. It builds the not-found view
 * model, composes the not-found view into the document layout, and renders the
 * result as a 404 response. It exists as the fetch-router fallback that serves the
 * 404 page for any request that matches no route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Renderer } from "remix/render-middleware";
import type { RemixNode } from "remix/ui";

import NotFoundViewModel from "~/app/http/view-models/not-found";
import DocumentLayout from "~/resources/layouts/document";
import NotFoundView from "~/resources/views/not-found";

interface RenderContext {
	render: Renderer<RemixNode>;
}

/** Renders the fallback 404 document for unmatched routes. */
export default function defaultHandler(ctx: RenderContext) {
	let props = NotFoundViewModel.default({ title: "Page Not Found" });

	return ctx.render(
		<DocumentLayout title={props.title}>
			<NotFoundView {...props} />
		</DocumentLayout>,
		{ status: 404 },
	);
}
