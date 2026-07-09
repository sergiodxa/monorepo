/**
 * `/vs/:slug` controller. Looks up the slug in `resources/content/marketing.ts`'s
 * `comparisons` record and renders the `ComparisonPageView` template (the generic
 * marketing page plus a head-to-head feature table); an unknown slug renders the
 * same 404 the router's `defaultHandler` uses. One controller covers all 10
 * comparison pages instead of one file per page — see the content module's
 * docblock for why.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import NotFoundViewModel from "~/app/http/view-models/not-found";
import { comparisons } from "~/resources/content/marketing";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout from "~/resources/layouts/marketing";
import ComparisonPageView from "~/resources/views/marketing/comparison";
import NotFoundView from "~/resources/views/not-found";
import routes from "~/routes/web";

/** GET /vs/:slug — a competitor comparison marketing page. */
export default createAction(routes.marketing.comparison, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let isSignedIn = getViewer() !== null;

	let content = comparisons[slug];
	if (!content) {
		let props = NotFoundViewModel.default({ title: "Page Not Found" });
		return ctx.render(
			<DocumentLayout title={props.title}>
				<NotFoundView {...props} />
			</DocumentLayout>,
			{ status: 404 },
		);
	}

	return ctx.render(
		<DocumentLayout title={`${content.metaTitle}`}>
			<MarketingLayout isSignedIn={isSignedIn}>
				<ComparisonPageView {...content} isSignedIn={isSignedIn} />
			</MarketingLayout>
		</DocumentLayout>,
	);
});
