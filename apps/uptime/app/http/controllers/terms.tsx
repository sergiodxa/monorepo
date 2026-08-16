/**
 * Terms of Service controller. Renders the static Terms of Service prose — covering
 * accounts, acceptable use, billing, data retention, service availability, liability,
 * and termination — inside the shared `MarketingLayout` chrome. Every section's copy
 * comes from `legal.terms.sections.*` in the locale files; the sibling `apps/uptime`
 * app only ever translated this page's SEO `meta.title`/`meta.description` (never its
 * body prose), so these `sections.*` keys are new and — like every other freshly
 * added key in this pass — only populated in `en.ts` for now, falling back to English
 * in every other locale until translated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@pkg/u/color";
import { m, maxIs, pbe, pbs, pi } from "@pkg/u/size";
import { fontSize } from "@pkg/u/typography";
import { Typeset } from "@pkg/ui";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import { SEO } from "~/app/lib/seo";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** GET /terms — the Terms of Service page. */
export default createAction(routes.legal.terms, async (ctx) => {
	let isSignedIn = getViewer() !== null;
	let chrome = buildMarketingChrome(ctx.i18next.t);

	return ctx.render(
		<DocumentLayout
			title={ctx.i18next.t("legal.terms.meta.title")}
			locale={ctx.locale}
			seo={{
				description: ctx.i18next.t("legal.terms.meta.description"),
				canonical: SEO.canonical(ctx.url),
				// A dated, versioned legal document, not a product page — `article` is
				// what its `lastUpdated` line and revision history actually describe.
				og: { type: "article" },
			}}
		>
			<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
				{/*
				 * Type comes from `Typeset`, the same as the docs layout and `/trust` — sizes,
				 * weights, vertical rhythm, list markers and links are all its decisions, not this
				 * page's. `preset="reading"` is the long-form rhythm these are.
				 *
				 * This element keeps only what is about placement: the measure and its padding.
				 */}
				<article mix={[maxIs("720px"), m(0, "auto"), pbs("48px"), pi("24px"), pbe("80px")]}>
					<Typeset preset="reading">
						<p mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>
							{ctx.i18next.t("legal.terms.lastUpdated")}
						</p>

						<h1>{ctx.i18next.t("legal.terms.title")}</h1>

						<h2>{ctx.i18next.t("legal.terms.sections.introduction.title")}</h2>
						<p>{ctx.i18next.t("legal.terms.sections.introduction.body")}</p>

						<h2>{ctx.i18next.t("legal.terms.sections.serviceDescription.title")}</h2>
						<p>{ctx.i18next.t("legal.terms.sections.serviceDescription.body")}</p>

						<h2>{ctx.i18next.t("legal.terms.sections.accountTerms.title")}</h2>
						<ul>
							<li>{ctx.i18next.t("legal.terms.sections.accountTerms.first")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.accountTerms.second")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.accountTerms.third")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.accountTerms.fourth")}</li>
						</ul>

						<h2>{ctx.i18next.t("legal.terms.sections.acceptableUse.title")}</h2>
						<p>{ctx.i18next.t("legal.terms.sections.acceptableUse.intro")}</p>
						<ul>
							<li>{ctx.i18next.t("legal.terms.sections.acceptableUse.first")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.acceptableUse.second")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.acceptableUse.third")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.acceptableUse.fourth")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.acceptableUse.fifth")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.acceptableUse.sixth")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.acceptableUse.seventh")}</li>
						</ul>

						<h2>{ctx.i18next.t("legal.terms.sections.paymentTerms.title")}</h2>
						<ul>
							<li>{ctx.i18next.t("legal.terms.sections.paymentTerms.first")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.paymentTerms.second")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.paymentTerms.third")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.paymentTerms.fourth")}</li>
						</ul>

						<h2>{ctx.i18next.t("legal.terms.sections.dataAndPrivacy.title")}</h2>
						<ul>
							<li>
								{ctx.i18next.t("legal.terms.sections.dataAndPrivacy.firstPrefix")}
								<a href={routes.legal.privacy.href()}>
									{ctx.i18next.t("legal.terms.sections.dataAndPrivacy.firstLinkText")}
								</a>
								{ctx.i18next.t("legal.terms.sections.dataAndPrivacy.firstSuffix")}
							</li>
							<li>{ctx.i18next.t("legal.terms.sections.dataAndPrivacy.second")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.dataAndPrivacy.third")}</li>
						</ul>

						<h2>{ctx.i18next.t("legal.terms.sections.serviceAvailability.title")}</h2>
						<ul>
							<li>{ctx.i18next.t("legal.terms.sections.serviceAvailability.first")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.serviceAvailability.second")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.serviceAvailability.third")}</li>
						</ul>

						<h2>{ctx.i18next.t("legal.terms.sections.limitationOfLiability.title")}</h2>
						<ul>
							<li>{ctx.i18next.t("legal.terms.sections.limitationOfLiability.first")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.limitationOfLiability.second")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.limitationOfLiability.third")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.limitationOfLiability.fourth")}</li>
						</ul>

						<h2>{ctx.i18next.t("legal.terms.sections.termination.title")}</h2>
						<ul>
							<li>{ctx.i18next.t("legal.terms.sections.termination.first")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.termination.second")}</li>
							<li>{ctx.i18next.t("legal.terms.sections.termination.third")}</li>
						</ul>

						<h2>{ctx.i18next.t("legal.terms.sections.changesToTerms.title")}</h2>
						<p>{ctx.i18next.t("legal.terms.sections.changesToTerms.body")}</p>

						<h2>{ctx.i18next.t("legal.terms.sections.contact.title")}</h2>
						<p>
							{ctx.i18next.t("legal.terms.sections.contact.prefix")}
							<a href={`mailto:${ctx.i18next.t("legal.terms.sections.contact.email")}`}>
								{ctx.i18next.t("legal.terms.sections.contact.email")}
							</a>
							.
						</p>
					</Typeset>
				</article>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
