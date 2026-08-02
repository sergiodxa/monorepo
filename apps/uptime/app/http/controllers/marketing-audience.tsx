/**
 * `/for/:slug` controller. Looks up the slug in `resources/content/marketing.ts`'s
 * `audiences` record and renders the shared `MarketingPageView` template; an unknown
 * slug renders the same 404 the router's `defaultHandler` uses. One controller covers
 * all 6 audience pages instead of one file per page — see the content module's
 * docblock for why.
 *
 * Structured data is the page's own `FAQPage`, built from the very questions it
 * renders so it never claims answers a visitor can't find. No
 * `SoftwareApplication` here: an audience page's subject is who the product is for,
 * not a capability of it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import { SEO } from "~/app/lib/seo";
import { audiences } from "~/resources/content/marketing";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import MarketingPageView, {
	buildMarketingPageChrome,
	SCREENSHOT_DARK,
	SCREENSHOT_LIGHT,
} from "~/resources/views/marketing/page";
import NotFoundView from "~/resources/views/not-found";
import routes from "~/routes/web";

/** GET /for/:slug — an audience marketing page. */
export default createAction(routes.marketing.audience, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let isSignedIn = getViewer() !== null;
	let chrome = buildMarketingChrome(ctx.i18next.t);

	let content = audiences[slug];
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
		<DocumentLayout
			title={`${content.metaTitle}`}
			locale={ctx.locale}
			seo={{
				description: content.metaDescription,
				canonical: SEO.canonical(ctx.url),
				schema: content.faqs.length > 0 ? SEO.schema.faq(content.faqs) : undefined,
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
