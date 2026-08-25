/**
 * The router's fallback handler: a URL beyond this server's routes gets the localized
 * 404 document, so a mistyped endpoint stays legible.
 *
 * Registered as the router's `defaultHandler`, so it runs for requests that matched no
 * route and every real route keeps priority over it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n } from "@pkg/i18n";
import type { Renderer } from "remix/middleware/render";
import type { RemixNode } from "remix/ui";

import NotFoundViewModel from "~/app/http/view-models/not-found";
import DocumentLayout from "~/resources/layouts/document";
import NotFoundView from "~/resources/views/not-found";

/** The slice of request context this handler reads. */
interface NotFoundContext {
	render: Renderer<RemixNode>;
	i18next: i18n;
}

/** Responds `404` with the localized not-found document. */
export default function defaultHandler(ctx: NotFoundContext) {
	let props = NotFoundViewModel.default({
		title: ctx.i18next.t("splat.notFound.title"),
		description: ctx.i18next.t("splat.notFound.description"),
	});
	return ctx.render(
		<DocumentLayout title={props.title}>
			<NotFoundView {...props} />
		</DocumentLayout>,
		{ status: 404 },
	);
}
