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
 * that would help somebody attack the service. Where the implementation does less than a
 * reader might hope — there is no second confirming check before the first notification — the
 * copy says so plainly instead of leaving the gap for them to discover during an outage.
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
 * The person who builds and operates the service. A single external link rather than a
 * translatable string, because the destination is the same in every locale and the
 * accountability this page claims is worthless if the name isn't checkable.
 */
const FOUNDER_URL = "https://sergiodxa.com";

/**
 * Where this app's source lives. "Code-available" rather than "open source" in the copy: the
 * repository carries its own license with conditions, and the claim being made here is only
 * that a reader can go and check the code, not that they may reuse it.
 */
const SOURCE_URL = "https://github.com/sergiodxa/monorepo/tree/main/apps/uptime";

/**
 * This service's own status page, built with the same cron-job monitoring the product
 * sells. It reports the app's scheduled internal work checking in on time — which is a
 * narrower claim than "everything is fine", and the copy beside it says so.
 */
const OWN_STATUS_PAGE_URL = "https://uptime.sergiodxa.com/status/uptime";

/**
 * The nine location hints a monitor can be probed from, in the order the monitor form
 * lists them. Named here so the page enumerates the same set the form offers rather
 * than a prose approximation of it; each id is a `trust.regions.*` copy key.
 */
const PROBE_REGIONS = ["afr", "apac", "eeur", "enam", "me", "oc", "sam", "weur", "wnam"] as const;

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
				{/*
				 * Every type decision — sizes, weights, vertical rhythm, list markers, and the
				 * brand-colored underlined links this page's whole argument rests on — comes from
				 * `Typeset`, the way the docs layout and the blog's post view already take theirs.
				 * `preset="reading"` is the long-form rhythm, which is what this is.
				 *
				 * This element keeps only what is genuinely about *this* page's placement on the
				 * screen: the measure and the padding around it.
				 */}
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
