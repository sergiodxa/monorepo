/**
 * `/trust` — how the monitoring actually works, and who runs it.
 *
 * Monitoring is bought on trust before it is bought on features: a false alarm costs the
 * same credibility as a missed one. This page makes that case in plain terms — where checks
 * run from, how an incident gets confirmed, what gets stored, and what happens when this
 * service itself has a bad day.
 *
 * Every claim here matches what the implementation actually does, staying free of internal
 * hostnames, credentials, or anything that would help an attacker; where the system falls
 * short of what a reader might hope, the copy names the gap plainly, ahead of any outage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { m, maxIs, pbe, pbs, pi } from "@pkg/u/size";
import { Typeset } from "@pkg/ui";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import { SEO } from "~/app/lib/seo";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/**
 * The person who builds and operates the service, kept as a single external link because
 * the destination is the same in every locale, and the accountability this page claims
 * depends on the name being checkable.
 */
const FOUNDER_URL = "https://sergiodxa.com";

/**
 * Where this app's source lives. The copy calls it "code-available" since the repository
 * carries its own license with conditions: reading the code is open to everyone, and reuse
 * stays governed by that license.
 */
const SOURCE_URL = "https://github.com/sergiodxa/monorepo/tree/main/apps/uptime";

/**
 * This service's own status page, built with the same cron-job monitoring the product
 * sells. It reports only that scheduled internal work checked in on time, and the copy
 * beside it states that scope plainly.
 */
const OWN_STATUS_PAGE_URL = "https://uptime.sergiodxa.com/status/uptime";

/**
 * The nine location hints a monitor can be probed from, in the order the monitor form
 * lists them, so the page enumerates exactly the set the form offers; each id is a
 * `trust.regions.*` copy key.
 */
const PROBE_REGIONS = ["afr", "apac", "eeur", "enam", "me", "oc", "sam", "weur", "wnam"] as const;

/**
 * GET /trust — the trust and reliability page. Typography comes entirely from `Typeset`
 * with `preset="reading"`; the `<article>` around it carries only the page's own measure
 * and padding.
 */
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
				<article mix={[maxIs("720px"), m(0, "auto"), pbs("48px"), pi("24px"), pbe("80px")]}>
					<Typeset preset="reading">
						<h1>{ctx.i18next.t("trust.heading")}</h1>
						<p>{ctx.i18next.t("trust.intro")}</p>

						<h2>{ctx.i18next.t("trust.sections.whoRuns.title")}</h2>
						<p>
							{ctx.i18next.t("trust.sections.whoRuns.bodyPrefix")}
							<a href={FOUNDER_URL} target="_blank" rel="noreferrer">
								{ctx.i18next.t("trust.sections.whoRuns.founderName")}
							</a>
							{ctx.i18next.t("trust.sections.whoRuns.bodySuffix")}
						</p>
						<p>{ctx.i18next.t("trust.sections.whoRuns.second")}</p>

						<h2>{ctx.i18next.t("trust.sections.source.title")}</h2>
						<p>
							{ctx.i18next.t("trust.sections.source.bodyPrefix")}
							<a href={SOURCE_URL} target="_blank" rel="noreferrer">
								{ctx.i18next.t("trust.sections.source.linkText")}
							</a>
							{ctx.i18next.t("trust.sections.source.bodySuffix")}
						</p>
						<p>{ctx.i18next.t("trust.sections.source.caveat")}</p>

						<h2>{ctx.i18next.t("trust.sections.ownStatus.title")}</h2>
						<p>
							{ctx.i18next.t("trust.sections.ownStatus.bodyPrefix")}
							<a href={OWN_STATUS_PAGE_URL} target="_blank" rel="noreferrer">
								{ctx.i18next.t("trust.sections.ownStatus.linkText")}
							</a>
							{ctx.i18next.t("trust.sections.ownStatus.bodySuffix")}
						</p>
						<p>{ctx.i18next.t("trust.sections.ownStatus.scope")}</p>

						<h2>{ctx.i18next.t("trust.sections.whereChecksRun.title")}</h2>
						<p>{ctx.i18next.t("trust.sections.whereChecksRun.intro")}</p>
						<ul>
							{PROBE_REGIONS.map((region) => (
								<li key={region}>{ctx.i18next.t(`trust.regions.${region}`)}</li>
							))}
						</ul>
						<p>{ctx.i18next.t("trust.sections.whereChecksRun.hint")}</p>
						<p>{ctx.i18next.t("trust.sections.whereChecksRun.timing")}</p>

						<h2>{ctx.i18next.t("trust.sections.incidents.title")}</h2>
						<p>{ctx.i18next.t("trust.sections.incidents.classification")}</p>
						<p>
							<strong>{ctx.i18next.t("trust.sections.incidents.noConfirmation")}</strong>
						</p>
						<p>{ctx.i18next.t("trust.sections.incidents.falsePositivesIntro")}</p>
						<ul>
							<li>
								<strong>{ctx.i18next.t("trust.sections.incidents.infraFault.label")}</strong>{" "}
								{ctx.i18next.t("trust.sections.incidents.infraFault.body")}
							</li>
							<li>
								<strong>{ctx.i18next.t("trust.sections.incidents.yourThresholds.label")}</strong>{" "}
								{ctx.i18next.t("trust.sections.incidents.yourThresholds.body")}
							</li>
							<li>
								<strong>{ctx.i18next.t("trust.sections.incidents.cooldown.label")}</strong>{" "}
								{ctx.i18next.t("trust.sections.incidents.cooldown.body")}
							</li>
							<li>
								<strong>{ctx.i18next.t("trust.sections.incidents.recovery.label")}</strong>{" "}
								{ctx.i18next.t("trust.sections.incidents.recovery.body")}
							</li>
							<li>
								<strong>{ctx.i18next.t("trust.sections.incidents.maintenance.label")}</strong>{" "}
								{ctx.i18next.t("trust.sections.incidents.maintenance.body")}
							</li>
							<li>
								<strong>{ctx.i18next.t("trust.sections.incidents.accounting.label")}</strong>{" "}
								{ctx.i18next.t("trust.sections.incidents.accounting.body")}
							</li>
						</ul>

						<h2>{ctx.i18next.t("trust.sections.storage.title")}</h2>
						<p>
							<strong>{ctx.i18next.t("trust.sections.storage.noBodies")}</strong>
						</p>
						<p>{ctx.i18next.t("trust.sections.storage.contentChecks")}</p>
						<p>{ctx.i18next.t("trust.sections.storage.storedIntro")}</p>
						<ul>
							<li>
								<strong>{ctx.i18next.t("trust.sections.storage.httpResults.label")}</strong>{" "}
								{ctx.i18next.t("trust.sections.storage.httpResults.body")}
							</li>
							<li>
								<strong>{ctx.i18next.t("trust.sections.storage.dailyStats.label")}</strong>{" "}
								{ctx.i18next.t("trust.sections.storage.dailyStats.body")}
							</li>
							<li>
								<strong>{ctx.i18next.t("trust.sections.storage.otherResults.label")}</strong>{" "}
								{ctx.i18next.t("trust.sections.storage.otherResults.body")}
							</li>
							<li>
								<strong>{ctx.i18next.t("trust.sections.storage.alertHistory.label")}</strong>{" "}
								{ctx.i18next.t("trust.sections.storage.alertHistory.body")}
							</li>
							<li>
								<strong>{ctx.i18next.t("trust.sections.storage.cronPings.label")}</strong>{" "}
								{ctx.i18next.t("trust.sections.storage.cronPings.body")}
							</li>
						</ul>

						<h2>{ctx.i18next.t("trust.sections.customerData.title")}</h2>
						<p>
							{ctx.i18next.t("trust.sections.customerData.bodyPrefix")}
							<a href={routes.legal.privacy.href()}>
								{ctx.i18next.t("trust.sections.customerData.privacyLinkText")}
							</a>
							{ctx.i18next.t("trust.sections.customerData.bodySuffix")}
						</p>

						<h2>{ctx.i18next.t("trust.sections.ourIncidents.title")}</h2>
						<p>{ctx.i18next.t("trust.sections.ourIncidents.retries")}</p>
						<p>{ctx.i18next.t("trust.sections.ourIncidents.gaps")}</p>
						<p>
							<strong>{ctx.i18next.t("trust.sections.ourIncidents.missedAlerts")}</strong>
						</p>
						<p>
							{ctx.i18next.t("trust.sections.ourIncidents.noSlaPrefix")}
							<a href={routes.legal.terms.href()}>
								{ctx.i18next.t("trust.sections.ourIncidents.termsLinkText")}
							</a>
							{ctx.i18next.t("trust.sections.ourIncidents.noSlaSuffix")}
						</p>
					</Typeset>
				</article>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
