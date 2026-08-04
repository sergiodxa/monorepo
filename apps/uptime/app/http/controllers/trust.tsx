/**
 * `/trust` — how the monitoring actually works, and who runs it.
 *
 * Monitoring is bought on trust before it is bought on features: a tool that tells you your
 * site is down is worth nothing unless you believe it, and worse than nothing if it cries
 * wolf. This page is where that case gets made in plain terms — where checks run from, how an
 * incident is confirmed before anyone is woken, what is and is not stored, and what happens
 * when this service itself has a bad day.
 *
 * Every claim here has to be something the implementation actually does. Nothing on this page
 * may be aspirational, and nothing may describe internal hostnames, credentials, or anything
 * that would help somebody attack the service.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import { SEO } from "~/app/lib/seo";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** GET /trust — the trust and reliability page. */
export default createAction(routes.trust, async (ctx) => {
	let isSignedIn = getViewer() !== null;
	let chrome = buildMarketingChrome(ctx.i18next.t);

	return ctx.render(
		<DocumentLayout
			title={ctx.i18next.t("trust.meta.title")}
			locale={ctx.locale}
			seo={{
				description: ctx.i18next.t("trust.meta.description"),
				canonical: SEO.canonical(ctx.url),
			}}
		>
			<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
				<h1>{ctx.i18next.t("trust.heading")}</h1>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
