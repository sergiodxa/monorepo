/**
 * The router's fallback handler: any URL this server does not serve gets the localized
 * 404 document rather than an empty response, so a mistyped endpoint is legible.
 *
 * It is the router's `defaultHandler` rather than a splat route, so it cannot shadow a
 * real route or be reached by a request that matched one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n } from "@pkg/i18n";
import type { Renderer } from "remix/render-middleware";
import type { RemixNode } from "remix/ui";

import NotFoundViewModel from "~/app/http/view-models/not-found";
import DocumentLayout from "~/resources/layouts/document";
import NotFoundView from "~/resources/views/not-found";

/** The slice of request context this handler reads. */
interface NotFoundContext {
	render: Renderer<RemixNode>;
	i18next: i18n;
}

/** Renders the fallback 404 document for unmatched routes. */
export default function defaultHandler(ctx: NotFoundContext) {
	let props = NotFoundViewModel.default({
		title: ctx.i18next.t("splat.notFound.title"),
		description: ctx.i18next.t("splat.notFound.description"),
	});
	let renderDocument = DocumentLayout();

	return ctx.render(
		renderDocument({
			title: props.title,
			children: <NotFoundView {...props} />,
		}),
		{ status: 404 },
	);
}
