/**
 * The home page, the first thing a visitor sees. It renders through the document layout,
 * which links the stylesheets and client entry the page middleware resolved.
 */

import { Trans } from "@sdxc/i18n/ui";
import { createAction } from "remix/router";

import page from "~/app/http/middleware/page";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

export default createAction(routes.home, {
	middleware: page,
	/** GET / — the welcome page. */
	handler: (ctx) =>
		ctx.render(
			<DocumentLayout assets={ctx.assets} intl={ctx.intl} title={ctx.intl.t("home.title")}>
				<h1>{ctx.intl.t("home.title")}</h1>
				<p>
					<Trans i18nKey="home.body" components={{ file: <code />, command: <code /> }} />
				</p>
			</DocumentLayout>,
		),
});
