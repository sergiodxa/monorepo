/**
 * `/features/:slug` controller. Looks up the slug in `resources/content/marketing.ts`'s
 * `features` record and renders the shared `MarketingPageView` template; an unknown
 * slug renders the same 404 the router's `defaultHandler` uses. One controller covers
 * all 12 feature pages instead of one file per page — see the content module's
 * docblock for why.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import { features } from "~/resources/content/marketing";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import MarketingPageView from "~/resources/views/marketing/page";
import NotFoundView from "~/resources/views/not-found";
import routes from "~/routes/web";

/** GET /features/:slug — a feature marketing page. */
export default createAction(routes.marketing.feature, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let isSignedIn = getViewer() !== null;
	let chrome = buildMarketingChrome(ctx.i18next.t);

	let content = features[slug];
	if (!content) {
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

	return ctx.render(
		<DocumentLayout title={`${content.metaTitle}`}>
			<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
				<MarketingPageView
					{...content}
					isSignedIn={isSignedIn}
					startLabel={chrome.startLabel}
					dashboardLabel={chrome.dashboardLabel}
					everythingTitle={ctx.i18next.t("landing.marketingPage.everythingTitle")}
					howItWorksTitle={ctx.i18next.t("landing.marketingPage.howItWorksTitle")}
					faqTitle={ctx.i18next.t("landing.marketingPage.faqTitle")}
					finalCtaTitle={ctx.i18next.t("landing.marketingPage.finalCtaTitle")}
					finalCtaBody={ctx.i18next.t("landing.finalCta.body")}
				/>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
