/**
 * `/for/:slug` controller. Looks up the slug in `resources/content/marketing.ts`'s
 * `audiences` record and renders it through `SolutionPageView`; an unknown slug renders
 * the same not-found page as the router's `defaultHandler`, with a 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import { SEO } from "~/app/initializers/seo";
import ProductMockup, { AUDIENCE_MOCKUPS } from "~/resources/components/marketing/product-mockups";
import { audiences } from "~/resources/content/marketing";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import SolutionPageView, { buildSolutionPageChrome } from "~/resources/views/marketing/solution";
import NotFoundView from "~/resources/views/not-found";
import routes from "~/routes/web";

/** GET /for/:slug — an audience marketing page. */
export default createAction(routes.marketing.audience, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let isSignedIn = getViewer() !== null;
	let chrome = buildMarketingChrome(ctx.intl.t);

	let content = audiences[slug];
	if (!content) {
		let props = {
			title: ctx.intl.t("notFound.title"),
			description: ctx.intl.t("notFound.description"),
		};
		return ctx.render(
			<DocumentLayout assets={ctx.assets} title={props.title}>
				<NotFoundView {...props} goBackHomeLabel={ctx.intl.t("notFound.goBackHome")} />
			</DocumentLayout>,
			{ status: 404 },
		);
	}

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={content.metaTitle}
			locale={ctx.locale}
			seo={{
				description: content.metaDescription,
				canonical: SEO.canonical(ctx.url),
				schema: content.faqs.length > 0 ? SEO.schema.faq(content.faqs) : undefined,
			}}
		>
			<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
				<SolutionPageView
					content={content}
					isSignedIn={isSignedIn}
					chrome={buildSolutionPageChrome(ctx.intl.t)}
					media={<ProductMockup area={AUDIENCE_MOCKUPS[slug] ?? "dashboard"} t={ctx.intl.t} />}
				/>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
