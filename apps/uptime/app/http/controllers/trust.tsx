/**
 * `/trust` — how the monitoring actually works, and who runs it. Monitoring is bought on
 * trust before it is bought on features: a false alarm costs the same credibility as a
 * missed one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ActivityIcon, CodeIcon, UserIcon } from "@sdxc/icons";
import { gap, grid, gridTemplate, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { is, maxIs, mbs, mi } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Feature, MarketingHeader, MarketingSection, Typeset } from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import { CheckList, CheckRow, LandingHero } from "@sdxc/ui/patterns";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import { SEO } from "~/app/initializers/seo";
import ClosingBand from "~/resources/components/marketing/closing-band";
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
 * GET /trust — the trust and reliability page. The accountability facts lead as cards and the
 * regions as their own band; the policies that need reading in full stay prose in one
 * `<article>` at reading measure, the only part the no-guarantee claim checks scan.
 */
export default createAction(routes.trust, async (ctx) => {
	let isSignedIn = getViewer() !== null;
	let chrome = buildMarketingChrome(ctx.intl.t);
	let t = ctx.intl.t;

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={t("trust.meta.title")}
			locale={ctx.locale}
			seo={{
				description: t("trust.meta.description"),
				canonical: SEO.canonical(ctx.url),
			}}
		>
			<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
				<LandingHero
					tone="tinted"
					align="center"
					level={1}
					title={t("trust.heading")}
					description={t("trust.intro")}
				/>

				<MarketingSection mix={[viewReveal()]}>
					<MarketingHeader eyebrow={t("trust.sections.accountability.badge")} align="center">
						{t("trust.sections.accountability.title")}
					</MarketingHeader>
					<Feature.Grid columns={3}>
						<Feature>
							<Feature.Icon tone="brand">
								<UserIcon size={24} strokeWidth={1.5} aria-hidden="true" />
							</Feature.Icon>
							<Feature.Title>{t("trust.sections.whoRuns.title")}</Feature.Title>
							<Feature.Description>
								<Typeset preset="chat">
									<p>
										{t("trust.sections.whoRuns.bodyPrefix")}
										<a href={FOUNDER_URL} target="_blank" rel="noreferrer">
											{t("trust.sections.whoRuns.founderName")}
										</a>
										{t("trust.sections.whoRuns.bodySuffix")}
									</p>
									<p>{t("trust.sections.whoRuns.second")}</p>
								</Typeset>
							</Feature.Description>
						</Feature>
						<Feature>
							<Feature.Icon tone="brand">
								<CodeIcon size={24} strokeWidth={1.5} aria-hidden="true" />
							</Feature.Icon>
							<Feature.Title>{t("trust.sections.source.title")}</Feature.Title>
							<Feature.Description>
								<Typeset preset="chat">
									<p>
										{t("trust.sections.source.bodyPrefix")}
										<a href={SOURCE_URL} target="_blank" rel="noreferrer">
											{t("trust.sections.source.linkText")}
										</a>
										{t("trust.sections.source.bodySuffix")}
									</p>
									<p>{t("trust.sections.source.caveat")}</p>
								</Typeset>
							</Feature.Description>
						</Feature>
						<Feature>
							<Feature.Icon tone="brand">
								<ActivityIcon size={24} strokeWidth={1.5} aria-hidden="true" />
							</Feature.Icon>
							<Feature.Title>{t("trust.sections.ownStatus.title")}</Feature.Title>
							<Feature.Description>
								<Typeset preset="chat">
									<p>
										{t("trust.sections.ownStatus.bodyPrefix")}
										<a href={OWN_STATUS_PAGE_URL} target="_blank" rel="noreferrer">
											{t("trust.sections.ownStatus.linkText")}
										</a>
										{t("trust.sections.ownStatus.bodySuffix")}
									</p>
									<p>{t("trust.sections.ownStatus.scope")}</p>
								</Typeset>
							</Feature.Description>
						</Feature>
					</Feature.Grid>
				</MarketingSection>

				<MarketingSection id="regions" tone="tinted" mix={[viewReveal()]}>
					<MarketingHeader description={t("trust.sections.whereChecksRun.intro")} align="center">
						{t("trust.sections.whereChecksRun.title")}
					</MarketingHeader>
					<CheckList
						mix={[
							grid(),
							gap(4),
							is("full"),
							mi("auto"),
							maxIs("720px"),
							gridTemplate({ columns: "minmax(0, 1fr)" }),
							at("40rem", gridTemplate({ columns: "repeat(3, minmax(0, 1fr))" })),
						]}
					>
						{PROBE_REGIONS.map((region) => (
							<CheckRow key={region}>{t(`trust.regions.${region}`)}</CheckRow>
						))}
					</CheckList>
					<div mix={[vstack({ gap: 4 }), mbs(12), is("full"), mi("auto"), maxIs("720px")]}>
						<p mix={[text("sm")]}>{t("trust.sections.whereChecksRun.hint")}</p>
						<p mix={[text("sm")]}>{t("trust.sections.whereChecksRun.timing")}</p>
					</div>
				</MarketingSection>

				<MarketingSection mix={[viewReveal()]}>
					<article mix={[is("full"), mi("auto"), maxIs("720px")]}>
						<Typeset preset="reading">
							<h2>{t("trust.sections.incidents.title")}</h2>
							<p>{t("trust.sections.incidents.classification")}</p>
							<p>
								<strong>{t("trust.sections.incidents.noConfirmation")}</strong>
							</p>
							<p>{t("trust.sections.incidents.falsePositivesIntro")}</p>
							<ul>
								<li>
									<strong>{t("trust.sections.incidents.infraFault.label")}</strong>{" "}
									{t("trust.sections.incidents.infraFault.body")}
								</li>
								<li>
									<strong>{t("trust.sections.incidents.yourThresholds.label")}</strong>{" "}
									{t("trust.sections.incidents.yourThresholds.body")}
								</li>
								<li>
									<strong>{t("trust.sections.incidents.cooldown.label")}</strong>{" "}
									{t("trust.sections.incidents.cooldown.body")}
								</li>
								<li>
									<strong>{t("trust.sections.incidents.recovery.label")}</strong>{" "}
									{t("trust.sections.incidents.recovery.body")}
								</li>
								<li>
									<strong>{t("trust.sections.incidents.maintenance.label")}</strong>{" "}
									{t("trust.sections.incidents.maintenance.body")}
								</li>
								<li>
									<strong>{t("trust.sections.incidents.accounting.label")}</strong>{" "}
									{t("trust.sections.incidents.accounting.body")}
								</li>
							</ul>

							<h2>{t("trust.sections.storage.title")}</h2>
							<p>
								<strong>{t("trust.sections.storage.noBodies")}</strong>
							</p>
							<p>{t("trust.sections.storage.contentChecks")}</p>
							<p>{t("trust.sections.storage.storedIntro")}</p>
							<ul>
								<li>
									<strong>{t("trust.sections.storage.httpResults.label")}</strong>{" "}
									{t("trust.sections.storage.httpResults.body")}
								</li>
								<li>
									<strong>{t("trust.sections.storage.dailyStats.label")}</strong>{" "}
									{t("trust.sections.storage.dailyStats.body")}
								</li>
								<li>
									<strong>{t("trust.sections.storage.otherResults.label")}</strong>{" "}
									{t("trust.sections.storage.otherResults.body")}
								</li>
								<li>
									<strong>{t("trust.sections.storage.alertHistory.label")}</strong>{" "}
									{t("trust.sections.storage.alertHistory.body")}
								</li>
								<li>
									<strong>{t("trust.sections.storage.cronPings.label")}</strong>{" "}
									{t("trust.sections.storage.cronPings.body")}
								</li>
							</ul>

							<h2>{t("trust.sections.customerData.title")}</h2>
							<p>
								{t("trust.sections.customerData.bodyPrefix")}
								<a href={routes.legal.privacy.href()} data-rmx-prefetch="intent">
									{t("trust.sections.customerData.privacyLinkText")}
								</a>
								{t("trust.sections.customerData.bodySuffix")}
							</p>

							<h2>{t("trust.sections.ourIncidents.title")}</h2>
							<p>{t("trust.sections.ourIncidents.retries")}</p>
							<p>{t("trust.sections.ourIncidents.gaps")}</p>
							<p>
								<strong>{t("trust.sections.ourIncidents.missedAlerts")}</strong>
							</p>
							<p>
								{t("trust.sections.ourIncidents.noSlaPrefix")}
								<a href={routes.legal.terms.href()} data-rmx-prefetch="intent">
									{t("trust.sections.ourIncidents.termsLinkText")}
								</a>
								{t("trust.sections.ourIncidents.noSlaSuffix")}
							</p>
						</Typeset>
					</article>
				</MarketingSection>

				<ClosingBand
					id="start"
					isSignedIn={isSignedIn}
					title={t("landing.marketingPage.finalCtaTitle")}
					description={t("landing.finalCta.body")}
					startLabel={chrome.startLabel}
					dashboardLabel={chrome.dashboardLabel}
				/>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
