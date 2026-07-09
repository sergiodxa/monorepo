/**
 * Terms of Service controller. Renders the static `TermsView` inside the shared
 * `MarketingLayout` chrome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout from "~/resources/layouts/marketing";
import TermsView from "~/resources/views/legal/terms";
import routes from "~/routes/web";

/** GET /terms — the Terms of Service page. */
export default createAction(routes.legal.terms, async (ctx) => {
	let isSignedIn = getViewer() !== null;

	return ctx.render(
		<DocumentLayout title="Terms of Service | Uptime">
			<MarketingLayout isSignedIn={isSignedIn}>
				<TermsView />
			</MarketingLayout>
		</DocumentLayout>,
	);
});
