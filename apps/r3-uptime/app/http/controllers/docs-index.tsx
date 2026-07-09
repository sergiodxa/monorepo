/**
 * `/docs` controller. Lists every doc section and renders the docs index inside the
 * shared `DocsLayout` sidebar chrome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/fetch-router";

import { listDocs } from "~/app/services/docs";
import DocsLayout from "~/resources/layouts/docs";
import DocumentLayout from "~/resources/layouts/document";
import DocsIndexView from "~/resources/views/docs/index";
import routes from "~/routes/web";

/** GET /docs — the documentation index. */
export default createAction(routes.docs.index, async (ctx) => {
	let sections = await listDocs();

	return ctx.render(
		<DocumentLayout title="Documentation | Uptime">
			<DocsLayout sections={sections}>
				<DocsIndexView sections={sections} />
			</DocsLayout>
		</DocumentLayout>,
	);
});
