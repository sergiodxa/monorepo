/**
 * Default request handler for the uptime router. It builds the not-found view
 * model, composes the not-found view into the document layout, and renders the
 * result as a 404 response. It exists as the fetch-router fallback that serves the
 * 404 page for any request that matches no route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n } from "@pkg/i18n";
import type { Renderer } from "remix/render-middleware";
import type { RemixNode } from "remix/ui";

import DocumentLayout from "~/resources/layouts/document";
import NotFoundView from "~/resources/views/not-found";

/**
 * Narrowed shape of `remix/fetch-router`'s `RequestContext` this handler
 * actually reads. `i18next` is declared here (rather than imported from
 * `remix/fetch-router` directly) only to keep this file's dependency surface
 * explicit; the global `i18n` middleware (see `bootstrap/app.tsx`) wraps the
 * whole router, `defaultHandler` included, so `ctx.i18next` is populated at
 * runtime the same way it is for every `createAction`/`createController`
 * handler.
 */
interface RenderContext {
	render: Renderer<RemixNode>;
	i18next: i18n;
}

/** Renders the fallback 404 document for unmatched routes. */
export default function defaultHandler(ctx: RenderContext) {
	let props = {
		title: ctx.i18next.t("notFound.title"),
		description: ctx.i18next.t("notFound.description"),
	};

	return ctx.render(
		<DocumentLayout title={props.title}>
			<NotFoundView {...props} goBackHomeLabel={ctx.i18next.t("notFound.goBackHome")} />
		</DocumentLayout>,
		{ status: 404 },
	);
}
