/**
 * Home controller. Renders the public marketing homepage — hero, trust indicators,
 * feature and use-case grids, a static pricing explanation, and an FAQ accordion —
 * inside the shared `MarketingLayout` chrome. It exists as the top-of-funnel entry
 * point for anonymous visitors, and as the redirect target for unauthenticated
 * `requireUser` guards (signed-in viewers see a "Go to dashboard" call to action
 * instead of a sign-in form).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout from "~/resources/layouts/marketing";
import HomeView from "~/resources/views/marketing/home";
import routes from "~/routes/web";

/** GET / — the public marketing homepage. */
export default createAction(routes.home, async (ctx) => {
	let isSignedIn = getViewer() !== null;

	return ctx.render(
		<DocumentLayout title="Uptime — Simple & reliable uptime monitoring for developers">
			<MarketingLayout isSignedIn={isSignedIn}>
				<HomeView isSignedIn={isSignedIn} />
			</MarketingLayout>
		</DocumentLayout>,
	);
});
