/**
 * `/features/:slug` controller. Looks up the slug in `resources/content/marketing.ts`'s
 * `features` record and renders the feature page on the landing components the home uses;
 * an unknown slug renders the same 404 the router's `defaultHandler` uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { RemixNode } from "remix/component";

import { redirect } from "@sdxc/http/response";
import { ArrowRightIcon, Icon } from "@sdxc/icons";
import { flexWrap, gap, inlineFlex, items, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Feature, LinkButton, MarketingHeader, MarketingSection, StatStrip } from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import {
	AccentText,
	CheckList,
	CheckRow,
	CodeStage,
	FaqBand,
	FeatureBand,
	LandingHero,
	StepList,
} from "@sdxc/ui/patterns";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import { getSoftwareApplicationSchema, SEO } from "~/app/initializers/seo";
import { FLOW_INTERVALS_SECONDS, FREE_TRIAL_DAYS } from "~/config/pricing";
import AuthCta from "~/resources/components/marketing/auth-cta";
import ClosingBand from "~/resources/components/marketing/closing-band";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import FlowDiagram from "~/resources/components/marketing/flow-diagram";
import ProductMockup, { FEATURE_MOCKUPS } from "~/resources/components/marketing/product-mockups";
import {
	BACKUP_SH,
	CREATE_MONITOR_SH,
	CRONTAB,
	MCP_JSON,
	ZONE_FILE,
} from "~/resources/content/code-samples";
import { features } from "~/resources/content/marketing";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import NotFoundView from "~/resources/views/not-found";
import routes from "~/routes/web";

/**
 * The companion visual a feature's "how it works" band shows beside its steps: the next
 * part of the product the steps lead into, or the code a reader pastes, so the band never
 * repeats the hero's mockup.
 *
 * @param slug The feature page's slug.
 * @param t The request's translator, for the mockups' and diagram's product copy.
 * @returns The visual, falling back to the dashboard for a slug with none of its own.
 */
function featureCompanion(slug: string, t: Translate): RemixNode {
	switch (slug) {
		case "alerts":
		case "integrations":
		case "ssl":
			return <ProductMockup area="monitor" t={t} />;
		case "teams":
			return <ProductMockup area="api-keys" t={t} />;
		case "maintenance":
			return <ProductMockup area="status-page" t={t} />;
		case "content-monitoring":
			return <ProductMockup area="alerts" t={t} />;
		case "api":
			return (
				<CodeStage
					variant="code"
					name="uptime-feature-api"
					tabs={[
						{ label: "create-monitor.sh", content: CREATE_MONITOR_SH, language: "sh" },
						{ label: "mcp.json", content: MCP_JSON, language: "json" },
					]}
				/>
			);
		case "cron-jobs":
			return (
				<CodeStage
					variant="code"
					name="uptime-feature-cron"
					tabs={[
						{ label: "crontab", content: CRONTAB, language: "sh" },
						{ label: "backup.sh", content: BACKUP_SH, language: "sh" },
					]}
				/>
			);
		case "dns":
			return (
				<CodeStage variant="code" title="example.com.zone" lineNumbers>
					{ZONE_FILE}
				</CodeStage>
			);
		case "flows":
			return (
				<FlowDiagram
					labels={{
						name: t("landing.flows.diagram.name"),
						pause: t("landing.flows.diagram.pause"),
						schedule: t("landing.flows.diagram.schedule"),
						scheduleDetail: t("landing.flows.diagram.scheduleDetail", {
							minutes: FLOW_INTERVALS_SECONDS[0] / 60,
						}),
						steps: [
							t("landing.flows.diagram.signIn"),
							t("landing.flows.diagram.token"),
							t("landing.flows.diagram.call"),
							t("landing.flows.diagram.check"),
						],
						passed: t("landing.flows.diagram.passed"),
						alert: t("landing.flows.diagram.alert"),
					}}
				/>
			);
		default:
			return <ProductMockup area="dashboard" t={t} />;
	}
}

/**
 * GET /features/:slug — a feature marketing page. The schema `name` strips the
 * meta title's "| Uptime …" suffix: a schema name just names the capability, where
 * the page `<title>` also has to place it in the site.
 */
export default createAction(routes.marketing.feature, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);

	if (slug === "browser-flows") {
		return redirect(routes.browserFlows.href(), { status: redirect.Status.Permanent });
	}

	let t = ctx.intl.t;
	let isSignedIn = getViewer() !== null;
	let chrome = buildMarketingChrome(t);

	let content = features[slug];
	if (!content) {
		let props = {
			title: t("notFound.title"),
			description: t("notFound.description"),
		};
		return ctx.render(
			<DocumentLayout assets={ctx.assets} title={props.title}>
				<NotFoundView {...props} goBackHomeLabel={t("notFound.goBackHome")} />
			</DocumentLayout>,
			{ status: 404 },
		);
	}

	let schemaName = content.metaTitle.split("|")[0]?.trim() || content.metaTitle;
	let companion = featureCompanion(slug, t);

	/** Two balanced accordion columns, the longer half first. */
	let faqSplitIndex = Math.ceil(content.faqs.length / 2);
	let firstFaqColumn = content.faqs.slice(0, faqSplitIndex);
	let secondFaqColumn = content.faqs.slice(faqSplitIndex);

	/**
	 * Four capabilities fill two rows of two and six fill two rows of three; any other count
	 * runs three across, where the grid widens the last row's cards to the full width.
	 */
	let featureColumns: 2 | 3 = content.features.length === 4 ? 2 : 3;

	let steps = content.steps.map((step) => (
		<StepList.Item key={step.title} title={step.title}>
			{step.description}
		</StepList.Item>
	));

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={content.metaTitle}
			locale={ctx.locale}
			seo={{
				description: content.metaDescription,
				canonical: SEO.canonical(ctx.url),
				schema: [
					getSoftwareApplicationSchema({
						name: schemaName,
						description: content.metaDescription,
						featureList: content.features.map((feature) => feature.title),
					}),
					...(content.faqs.length > 0 ? [SEO.schema.faq(content.faqs)] : []),
				],
			}}
		>
			<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
				<LandingHero
					tone="tinted"
					mediaPlacement="end"
					entrance
					eyebrow={content.badge}
					eyebrowVariant="pill"
					title={
						<>
							{content.title} <AccentText>{content.highlight}</AccentText>
						</>
					}
					description={content.description}
					actions={
						<div mix={[vstack({ gap: 4, align: "start" }), is("full")]}>
							<div mix={[inlineFlex(), flexWrap(), items("center"), gap(3)]}>
								{isSignedIn ? (
									<AuthCta
										isSignedIn
										startLabel={chrome.startLabel}
										dashboardLabel={chrome.dashboardLabel}
										icon={<ArrowRightIcon size={20} strokeWidth={1.5} aria-hidden="true" />}
									/>
								) : (
									<LinkButton href={routes.trial.check.index.href()} color="brand" size="lg">
										{t("landing.hero.cta.try", { days: FREE_TRIAL_DAYS })}
										<ArrowRightIcon size={20} strokeWidth={1.5} aria-hidden="true" />
									</LinkButton>
								)}
								<LinkButton
									href={`${routes.home.href()}#pricing`}
									prefetch="intent"
									color="neutral"
									variant="outline"
									size="lg"
								>
									{t("landing.hero.cta.pricing")}
								</LinkButton>
							</div>
							<CheckList orientation="horizontal">
								{content.highlights.map((highlight) => (
									<CheckRow key={highlight}>{highlight}</CheckRow>
								))}
							</CheckList>
						</div>
					}
					media={<ProductMockup area={FEATURE_MOCKUPS[slug] ?? "dashboard"} t={t} />}
				/>

				{content.trustIndicators ? (
					<MarketingSection spacing="compact" mix={[viewReveal()]}>
						<StatStrip size="display" variant="gap" align="center">
							{content.trustIndicators.map((indicator) => (
								<StatStrip.Item key={indicator.label} label={indicator.label}>
									{indicator.value}
								</StatStrip.Item>
							))}
						</StatStrip>
					</MarketingSection>
				) : null}

				<MarketingSection id="features" tone="tinted" mix={[viewReveal()]}>
					<MarketingHeader
						eyebrow={t("landing.marketingPage.everythingBadge")}
						description={t("landing.marketingPage.everythingDescription")}
						align="center"
					>
						{t("landing.marketingPage.everythingTitle")}
					</MarketingHeader>
					<Feature.Grid columns={featureColumns}>
						{content.features.map((feature) => (
							<Feature key={feature.title}>
								{feature.icon ? (
									<Feature.Icon tone="brand">
										<Icon name={feature.icon} size={20} strokeWidth={1.5} aria-hidden="true" />
									</Feature.Icon>
								) : null}
								<Feature.Title>{feature.title}</Feature.Title>
								<Feature.Description>{feature.description}</Feature.Description>
							</Feature>
						))}
					</Feature.Grid>
				</MarketingSection>

				<FeatureBand
					id="how-it-works"
					layout="split"
					lean="media"
					eyebrow={t("landing.marketingPage.howItWorksBadge")}
					title={t("landing.marketingPage.howItWorksTitle")}
					description={t("landing.marketingPage.howItWorksDescription")}
					media={companion}
					mix={[viewReveal()]}
				>
					<StepList variant="timeline">{steps}</StepList>
				</FeatureBand>

				<FaqBand
					id="faq"
					columns={2}
					tone="tinted"
					eyebrow={t("landing.marketingPage.faqBadge")}
					title={t("landing.marketingPage.faqTitle")}
					description={t("landing.marketingPage.faqDescription")}
					mix={[viewReveal()]}
				>
					<FaqAccordion items={firstFaqColumn} />
					<FaqAccordion items={secondFaqColumn} />
				</FaqBand>

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
