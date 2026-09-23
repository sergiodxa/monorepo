/**
 * Default request handler for the uptime router. It builds the not-found view
 * model, composes the not-found view into the document layout, and renders the
 * result as a 404 response. It exists as the fetch-router fallback that serves the
 * 404 page for any request that matches no route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { I18n } from "@sdxc/i18n";
import type { Renderer } from "remix/middleware/render";
import type { RemixNode } from "remix/ui";

import DocumentLayout from "~/resources/layouts/document";
import NotFoundView from "~/resources/views/not-found";

/**
 * Narrows `remix/router`'s `RequestContext` to the fields this handler reads,
 * keeping the dependency surface explicit. The global `i18n` middleware wraps
 * the whole router, so `ctx.intl` is already populated at runtime.
 */
interface RenderContext {
	render: Renderer<RemixNode>;
	intl: I18n;
}

/** Renders the fallback 404 document for unmatched routes. */
export default function defaultHandler(ctx: RenderContext) {
	let props = {
		title: ctx.intl.t("notFound.title"),
		description: ctx.intl.t("notFound.description"),
	};

	return ctx.render(
		<DocumentLayout title={props.title}>
			<NotFoundView {...props} goBackHomeLabel={ctx.intl.t("notFound.goBackHome")} />
		</DocumentLayout>,
		{ status: 404 },
	);
}
