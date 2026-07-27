/**
 * Privacy Policy controller. Renders the static GDPR-oriented prose — covering data
 * collected, usage, sharing, retention, rights, security, and cookies — inside the
 * shared `MarketingLayout` chrome. Every section's copy comes from
 * `legal.privacy.sections.*` in the locale files; the sibling `apps/uptime` app only
 * ever translated this page's SEO `meta.title`/`meta.description` (never its body
 * prose), so these `sections.*` keys are new and — like every other freshly added
 * key in this pass — only populated in `en.ts` for now, falling back to English in
 * every other locale until translated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@pkg/u/color";
import { m, maxIs, mbe, mbs, pbe, pbs, pi, pis } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { fontSize, leading, tracking, weight } from "@pkg/u/typography";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** GET /privacy — the Privacy Policy page. */
export default createAction(routes.legal.privacy, async (ctx) => {
	let isSignedIn = getViewer() !== null;
	let chrome = buildMarketingChrome(ctx.i18next.t);

	return ctx.render(
		<DocumentLayout title={ctx.i18next.t("legal.privacy.meta.title")}>
			<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
				<article
					mix={[
						maxIs("720px"),
						m(0, "auto"),
						pbs("48px"),
						pi("24px"),
						pbe("80px"),
						leading(1.75),
						fg("neutral"),
						when("& h1", [
							fontSize("2.25rem"),
							weight(800),
							tracking("tight"),
							mbs(0),
							mbe("32px"),
							fg("neutral.emphasis"),
						]),
						when("& h2", [
							fontSize("1.5rem"),
							weight(700),
							mbs("48px"),
							mbe("24px"),
							fg("neutral.emphasis"),
						]),
						when("& h3", [
							fontSize("1.25rem"),
							weight(600),
							mbs("24px"),
							mbe("12px"),
							fg("neutral.emphasis"),
						]),
						when("& p", m("20px", 0)),
						when("& ul", [m("20px", 0), pis("1.25rem")]),
						when("& li", mbe("8px")),
					]}
				>
					<p mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>
						{ctx.i18next.t("legal.privacy.lastUpdated")}
					</p>

					<h1>{ctx.i18next.t("legal.privacy.title")}</h1>

					<h2>{ctx.i18next.t("legal.privacy.sections.introduction.title")}</h2>
					<p>{ctx.i18next.t("legal.privacy.sections.introduction.first")}</p>
					<p>{ctx.i18next.t("legal.privacy.sections.introduction.second")}</p>

					<h2>{ctx.i18next.t("legal.privacy.sections.dataCollected.title")}</h2>

					<h3>{ctx.i18next.t("legal.privacy.sections.dataCollected.accountData.title")}</h3>
					<p>{ctx.i18next.t("legal.privacy.sections.dataCollected.accountData.body")}</p>

					<h3>{ctx.i18next.t("legal.privacy.sections.dataCollected.monitoringData.title")}</h3>
					<p>{ctx.i18next.t("legal.privacy.sections.dataCollected.monitoringData.body")}</p>

					<h3>{ctx.i18next.t("legal.privacy.sections.dataCollected.cronJobData.title")}</h3>
					<p>{ctx.i18next.t("legal.privacy.sections.dataCollected.cronJobData.intro")}</p>
					<ul>
						<li>{ctx.i18next.t("legal.privacy.sections.dataCollected.cronJobData.first")}</li>
						<li>{ctx.i18next.t("legal.privacy.sections.dataCollected.cronJobData.second")}</li>
						<li>{ctx.i18next.t("legal.privacy.sections.dataCollected.cronJobData.third")}</li>
						<li>{ctx.i18next.t("legal.privacy.sections.dataCollected.cronJobData.fourth")}</li>
					</ul>
					<p>{ctx.i18next.t("legal.privacy.sections.dataCollected.cronJobData.outro")}</p>

					<h3>{ctx.i18next.t("legal.privacy.sections.dataCollected.usageData.title")}</h3>
					<p>{ctx.i18next.t("legal.privacy.sections.dataCollected.usageData.body")}</p>

					<h3>{ctx.i18next.t("legal.privacy.sections.dataCollected.paymentData.title")}</h3>
					<p>{ctx.i18next.t("legal.privacy.sections.dataCollected.paymentData.body")}</p>

					<h2>{ctx.i18next.t("legal.privacy.sections.dataUsage.title")}</h2>
					<ul>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.dataUsage.first.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.dataUsage.first.body")}
						</li>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.dataUsage.second.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.dataUsage.second.body")}
						</li>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.dataUsage.third.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.dataUsage.third.body")}
						</li>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.dataUsage.fourth.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.dataUsage.fourth.body")}
						</li>
					</ul>

					<h2>{ctx.i18next.t("legal.privacy.sections.dataSharing.title")}</h2>
					<p>
						<strong>{ctx.i18next.t("legal.privacy.sections.dataSharing.noSell")}</strong>
					</p>
					<p>{ctx.i18next.t("legal.privacy.sections.dataSharing.intro")}</p>
					<ul>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.dataSharing.first.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.dataSharing.first.body")}
						</li>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.dataSharing.second.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.dataSharing.second.body")}
						</li>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.dataSharing.third.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.dataSharing.third.body")}
						</li>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.dataSharing.fourth.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.dataSharing.fourth.body")}
						</li>
					</ul>
					<p>{ctx.i18next.t("legal.privacy.sections.dataSharing.outro")}</p>

					<h2>{ctx.i18next.t("legal.privacy.sections.dataRetention.title")}</h2>
					<ul>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.dataRetention.first.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.dataRetention.first.body")}
						</li>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.dataRetention.second.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.dataRetention.second.body")}
						</li>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.dataRetention.third.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.dataRetention.third.body")}
						</li>
					</ul>

					<h2>{ctx.i18next.t("legal.privacy.sections.rights.title")}</h2>
					<p>{ctx.i18next.t("legal.privacy.sections.rights.intro")}</p>
					<ul>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.rights.first.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.rights.first.body")}
						</li>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.rights.second.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.rights.second.body")}
						</li>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.rights.third.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.rights.third.body")}
						</li>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.rights.fourth.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.rights.fourth.body")}
						</li>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.rights.fifth.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.rights.fifth.body")}
						</li>
					</ul>
					<p>{ctx.i18next.t("legal.privacy.sections.rights.outro")}</p>

					<h2>{ctx.i18next.t("legal.privacy.sections.security.title")}</h2>
					<p>{ctx.i18next.t("legal.privacy.sections.security.intro")}</p>
					<ul>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.security.first.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.security.first.body")}
						</li>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.security.second.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.security.second.body")}
						</li>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.security.third.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.security.third.body")}
						</li>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.security.fourth.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.security.fourth.body")}
						</li>
					</ul>

					<h2>{ctx.i18next.t("legal.privacy.sections.cookies.title")}</h2>
					<p>{ctx.i18next.t("legal.privacy.sections.cookies.intro")}</p>
					<ul>
						<li>
							<strong>{ctx.i18next.t("legal.privacy.sections.cookies.first.label")}</strong>{" "}
							{ctx.i18next.t("legal.privacy.sections.cookies.first.body")}
						</li>
					</ul>
					<p>{ctx.i18next.t("legal.privacy.sections.cookies.outro")}</p>

					<h2>{ctx.i18next.t("legal.privacy.sections.childrensPrivacy.title")}</h2>
					<p>{ctx.i18next.t("legal.privacy.sections.childrensPrivacy.body")}</p>

					<h2>{ctx.i18next.t("legal.privacy.sections.internationalTransfers.title")}</h2>
					<p>{ctx.i18next.t("legal.privacy.sections.internationalTransfers.first")}</p>
					<p>{ctx.i18next.t("legal.privacy.sections.internationalTransfers.second")}</p>

					<h2>{ctx.i18next.t("legal.privacy.sections.changesToPolicy.title")}</h2>
					<p>{ctx.i18next.t("legal.privacy.sections.changesToPolicy.first")}</p>
					<p>{ctx.i18next.t("legal.privacy.sections.changesToPolicy.second")}</p>

					<h2>{ctx.i18next.t("legal.privacy.sections.contact.title")}</h2>
					<p>{ctx.i18next.t("legal.privacy.sections.contact.body")}</p>
					<p>
						<a href={`mailto:${ctx.i18next.t("legal.privacy.sections.contact.email")}`}>
							{ctx.i18next.t("legal.privacy.sections.contact.email")}
						</a>
					</p>
				</article>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
