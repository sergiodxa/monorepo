/**
 * The 404 page for any path no other route claims, with a way back home. An unknown path
 * under `/api` answers a problem document instead, from its own route.
 */

import { createAction } from "remix/router";

import page from "~/app/http/middleware/page";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

export default createAction(routes.notFound, {
	middleware: page,
	/** Any method on an unknown path renders the 404 document. */
	handler: (ctx) =>
		ctx.render(
			<DocumentLayout
				assets={ctx.assets}
				intl={ctx.intl}
				url={ctx.url}
				title={ctx.intl.t("notFound.title")}
			>
				<h1>{ctx.intl.t("notFound.title")}</h1>
				<p>
					<a href={routes.home.href()}>{ctx.intl.t("notFound.back")}</a>
				</p>
			</DocumentLayout>,
			{ status: 404 },
		),
});
