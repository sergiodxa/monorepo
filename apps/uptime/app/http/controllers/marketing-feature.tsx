/**
 * `/features/:slug` controller. Looks up the slug in `resources/content/marketing.ts`'s
 * `features` record and renders the shared `MarketingPageView` template; an unknown
 * slug renders the same 404 the router's `defaultHandler` uses. One controller covers
 * all 12 feature pages instead of one file per page — see the content module's
 * docblock for why.
 *
 * Each page describes itself to crawlers as a `SoftwareApplication` — its subject is
 * one capability of the product — plus an `FAQPage` built from the very questions the
 * page renders, so the structured data never claims answers a visitor can't find.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import { getSoftwareApplicationSchema, SEO } from "~/app/lib/seo";
import { features } from "~/resources/content/marketing";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import MarketingPageView, {
	buildMarketingPageChrome,
	SCREENSHOT_DARK,
	SCREENSHOT_LIGHT,
} from "~/resources/views/marketing/page";
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

	// The capability this page is about, taken from its meta title without the
	// "| Uptime …" half — a schema `name` names the thing, where a `<title>` also
	// has to place it inside the site.
	let schemaName = content.metaTitle.split("|")[0]?.trim() || content.metaTitle;

	return ctx.render(
		<DocumentLayout
			title={`${content.metaTitle}`}
			locale={ctx.locale}
			seo={{
				description: content.metaDescription,
				canonical: SEO.canonical(ctx.url),
				schema: [
					getSoftwareApplicationSchema({
						name: schemaName,
						description: content.metaDescription,
						// The very bullets the feature grid renders below the hero.
						featureList: content.features.map((feature) => feature.title),
					}),
					...(content.faqs.length > 0 ? [SEO.schema.faq(content.faqs)] : []),
				],
			}}
			preload={[
				{ href: SCREENSHOT_LIGHT, as: "image", media: "(prefers-color-scheme: light)" },
				{ href: SCREENSHOT_DARK, as: "image", media: "(prefers-color-scheme: dark)" },
			]}
		>
			<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
				<MarketingPageView
					{...content}
					{...buildMarketingPageChrome(ctx.i18next.t)}
					isSignedIn={isSignedIn}
				/>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
