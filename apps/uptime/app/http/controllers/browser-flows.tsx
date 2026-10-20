/**
 * `/browser-flows` — the dedicated selling page for real-browser click-through
 * monitoring. Lives outside the shared `/features/:slug` template so the hero can
 * lead with a live spec example and contrast HTTP vs browser billing in one
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import { getSoftwareApplicationSchema, SEO } from "~/app/initializers/seo";
import { FREE_TRIAL_DAYS } from "~/config/pricing";
import { browserFlowsPage } from "~/resources/content/browser-flows";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import BrowserFlowsView from "~/resources/views/marketing/browser-flows";
import routes from "~/routes/web";

/** GET /browser-flows — the browser-flow product landing. */
export default createAction(routes.browserFlows, async (ctx) => {
	let isSignedIn = getViewer() !== null;
	let chrome = buildMarketingChrome(ctx.intl.t);
	let t = ctx.intl.t;
	let page = browserFlowsPage;

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={page.metaTitle}
			locale={ctx.locale}
			seo={{
				description: page.metaDescription,
				canonical: SEO.canonical(ctx.url),
				schema: [
					getSoftwareApplicationSchema({
						name: "Browser Flow Monitoring",
						description: page.metaDescription,
						featureList: [
							"Real Browser Run sessions",
							"Accessibility role and name addressing",
							"Per-run metering separate from pings",
						],
					}),
					SEO.schema.faq([...page.faqs]),
				],
			}}
		>
			<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
				<BrowserFlowsView
					isSignedIn={isSignedIn}
					startLabel={t("landing.hero.cta.out")}
					dashboardLabel={t("landing.hero.cta.in")}
					pricingLabel={t("landing.hero.cta.pricing")}
					tryLabel={t("landing.hero.cta.try", { days: FREE_TRIAL_DAYS })}
				/>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
