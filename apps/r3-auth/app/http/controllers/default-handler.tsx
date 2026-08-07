/**
 * The router's fallback handler: any URL this server does not serve gets the 404
 * document rather than an empty response, so a mistyped endpoint is legible.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Renderer } from "remix/render-middleware";
import type { RemixNode } from "remix/ui";

import NotFoundViewModel from "~/app/http/view-models/not-found";
import DocumentLayout from "~/resources/layouts/document";
import NotFoundView from "~/resources/views/not-found";

/** The slice of request context this handler reads. */
interface RenderContext {
	render: Renderer<RemixNode>;
}

/** Renders the fallback 404 document for unmatched routes. */
export default function defaultHandler(ctx: RenderContext) {
	let props = NotFoundViewModel.default({ title: "Page Not Found" });
	let renderDocument = DocumentLayout();

	return ctx.render(
		renderDocument({
			title: props.title,
			children: <NotFoundView {...props} />,
		}),
		{ status: 404 },
	);
}
