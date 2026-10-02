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

import type { I18n } from "@sdxc/i18n";
import type { RemixNode } from "remix/component";
import type { Renderer } from "remix/middleware/render";

import NotFoundViewModel from "~/app/http/view-models/not-found";
import DocumentLayout from "~/resources/layouts/document";
import NotFoundView from "~/resources/views/not-found";

/** The slice of request context this handler reads. */
interface NotFoundContext {
	render: Renderer<RemixNode>;
	intl: I18n;
}

/** Responds `404` with the localized not-found document. */
export default function defaultHandler(ctx: NotFoundContext) {
	let props = NotFoundViewModel.default({
		title: ctx.intl.t("splat.notFound.title"),
		description: ctx.intl.t("splat.notFound.description"),
	});
	return ctx.render(
		<DocumentLayout title={props.title}>
			<NotFoundView {...props} />
		</DocumentLayout>,
		{ status: 404 },
	);
}
