/**
 * The router's default handler: any request that matches no route gets the app's own 404
 * page, with a way back home.
 */

import type { RequestContext } from "remix/router";

import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * Renders the 404 document. It takes only the members it reads, since the router derives
 * `AppContext` from the options this handler is passed in.
 */
export default function notFound(ctx: Pick<RequestContext, "assets" | "render">) {
	return ctx.render(
		<DocumentLayout assets={ctx.assets} title="Not found">
			<h1>Not found</h1>
			<p>
				<a href={routes.home.href()}>Back home</a>
			</p>
		</DocumentLayout>,
		{ status: 404 },
	);
}
