/**
 * Privacy Policy controller. Renders the static `PrivacyView` inside the shared
 * `MarketingLayout` chrome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout from "~/resources/layouts/marketing";
import PrivacyView from "~/resources/views/legal/privacy";
import routes from "~/routes/web";

/** GET /privacy — the Privacy Policy page. */
export default createAction(routes.legal.privacy, async (ctx) => {
	let isSignedIn = getViewer() !== null;

	return ctx.render(
		<DocumentLayout title="Privacy Policy | Uptime">
			<MarketingLayout isSignedIn={isSignedIn}>
				<PrivacyView />
			</MarketingLayout>
		</DocumentLayout>,
	);
});
