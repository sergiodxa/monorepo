/**
 * `GET /try/report/:token` — the seven-day health report as a page.
 *
 * The report already existed as an email. A page is what makes it an artifact: something a
 * reader can come back to, forward to a colleague or a client, and arrive at from the email
 * days later — and something a conversion call to action can live on once the trial is over
 * and the inbox has moved on.
 *
 * Addressed by the watch's own `report_token` and nothing else, because there is no account
 * behind a trial and the URL is therefore the only credential available. That token is
 * deliberately not the lead's unsubscribe token: this link is meant to be shared, and sharing
 * it must never hand somebody the power to delete the reader's address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/fetch-router";

import { SEO } from "~/app/lib/seo";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** GET /try/report/:token — one trial target's health report. */
export default createAction(routes.trial.report, async (ctx) => {
	let { token } = s.parse(s.object({ token: s.string() }), ctx.params);
	let chrome = buildMarketingChrome(ctx.i18next.t);

	return ctx.render(
		<DocumentLayout
			title={ctx.i18next.t("trial.report.meta.title")}
			locale={ctx.locale}
			seo={{
				description: ctx.i18next.t("trial.report.meta.description"),
				canonical: SEO.canonical(ctx.url),
			}}
		>
			<MarketingLayout isSignedIn={false} {...chrome}>
				<h1>{token}</h1>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
