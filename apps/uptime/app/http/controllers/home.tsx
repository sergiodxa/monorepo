/**
 * Home controller — the public marketing homepage, product-led: the dashboard in the hero,
 * real product figures, a free check, the features, the API and MCP surface, browser
 * flows, pricing from `config/pricing.ts`, the FAQ and a closing call, inside `MarketingLayout`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TurnstileWidget } from "@sdxc/captcha/turnstile/ui";
import { HoneypotFields } from "@sdxc/honeypot/ui";
import { IntlProvider, Trans } from "@sdxc/i18n/ui";
import {
	ActivityIcon,
	AppWindowIcon,
	ArrowRightIcon,
	BellIcon,
	BotIcon,
	CirclePauseIcon,
	ClockIcon,
	CodeIcon,
	CreditCardIcon,
	FileTextIcon,
	GlobeIcon,
	LayersIcon,
	LinkIcon,
	LockIcon,
	MessageSquareIcon,
	RefreshCwIcon,
	TimerIcon,
	UsersIcon,
	WorkflowIcon,
} from "@sdxc/icons";
import { unwrap } from "@sdxc/result";
import {
	flexRow,
	flexWrap,
	gap,
	grow,
	hstack,
	inlineFlex,
	items,
	justify,
	shrink,
	vstack,
} from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is, mbs, mi, maxIs } from "@sdxc/u/size";
import { nowrap, text, textAlign } from "@sdxc/u/typography";
import {
	Button,
	Feature,
	LinkButton,
	MarketingHeader,
	MarketingSection,
	StatStrip,
	TextField,
} from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import {
	AccentText,
	CheckList,
	CheckRow,
	CodeStage,
	FaqBand,
	FeatureBand,
	LandingHero,
} from "@sdxc/ui/patterns";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import { TRIAL_URL_FIELD, TURNSTILE_FIELD } from "~/app/http/validators/trial";
import { SEO } from "~/app/initializers/seo";
import { trialTurnstileSiteKey } from "~/app/services/trial/guard";
import {
	BASE_PRICE_USD,
	FLOW_INTERVALS_SECONDS,
	INCLUDED_PINGS,
	PINGS_PER_BLOCK,
	PRICE_PER_BLOCK_USD,
	PRICE_PER_FLOW_RUN_USD,
} from "~/config/pricing";
import AuthCta from "~/resources/components/marketing/auth-cta";
import ClosingBand from "~/resources/components/marketing/closing-band";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import FlowDiagram from "~/resources/components/marketing/flow-diagram";
import {
	AlertsScene,
	MonitorsScene,
	StatusPageScene,
} from "~/resources/components/marketing/product-scenes";
import ProductScreenshot, {
	SCREENSHOT_PRELOADS,
} from "~/resources/components/marketing/product-screenshot";
import PricingCalculator from "~/resources/components/pricing-calculator";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/**
 * Creating a monitor over the REST API, as the HTTP monitors reference documents it. The
 * host and fields are the public contract, so they stay literal.
 */
const CREATE_MONITOR_SH = `curl https://uptime.sergiodxa.com/api/v1/monitors \\
  -H "Authorization: Bearer uptime_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Production API",
    "url": "https://api.example.com/health",
    "method": "GET",
    "expectedStatus": 200,
    "intervalSeconds": 60
  }'`;

/**
 * The mcp-bridge config an agent's client loads, identical to the one `/mcp` hands a
 * signed-in visitor: the endpoint and header are what a client copies verbatim.
 */
const MCP_JSON = `{
  "command": "npx",
  "args": [
    "-y",
    "@sdxc/mcp@latest",
    "https://uptime.sergiodxa.com/mcp",
    "--header",
    "Authorization:Bearer \${UPTIME_MCP_TOKEN}"
  ]
}`;

/** Formats a USD amount in `locale`, dropping the cents on whole amounts. */
function formatMoney(locale: string, amount: number): string {
	return amount.toLocaleString(locale, {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	});
}

/** Formats a whole count (a ping allowance) in `locale`. */
function formatCount(locale: string, value: number): string {
	return value.toLocaleString(locale, { maximumFractionDigits: 0 });
}

/** GET / — the public marketing homepage. */
export default createAction(routes.home, async (ctx) => {
	let isSignedIn = getViewer() !== null;
	let chrome = buildMarketingChrome(ctx.intl.t);
	let t = ctx.intl.t;

	let HERO_TRUST_INDICATORS = [
		t("landing.hero.trustIndicators.freeToStart"),
		t("landing.hero.trustIndicators.payForAutomation"),
		t("landing.hero.trustIndicators.cancelAnytime"),
	];

	/**
	 * Each value is a verifiable product spec, so every figure in this strip can be checked
	 * against real behavior. "1min" is the enforced check-interval floor:
	 * `interval_seconds` carries a 60-second minimum in validation.
	 */
	let PRODUCT_FIGURES = [
		{ value: "6", label: t("landing.trustIndicators.monitorTypes") },
		{ value: "9", label: t("landing.trustIndicators.globalRegions") },
		{ value: "365", label: t("landing.trustIndicators.daysDataRetention") },
		{ value: "1min", label: t("landing.trustIndicators.minCheckInterval") },
	];

	/**
	 * Nine capabilities, each linking to the page that argues it in full; nine fills three
	 * rows of three, so no card sits alone on the last row.
	 */
	let FEATURE_LINKS = [
		{
			title: t("landing.features.list.first.title"),
			description: t("landing.features.list.first.description"),
			href: routes.marketing.feature.href({ slug: "monitors" }),
			icon: <ActivityIcon size={20} strokeWidth={1.5} aria-hidden="true" />,
			media: <MonitorsScene upLabel={t("statusPage.status.operational")} />,
		},
		{
			title: t("landing.features.list.second.title"),
			description: t("landing.features.list.second.description"),
			href: routes.marketing.feature.href({ slug: "alerts" }),
			icon: <BellIcon size={20} strokeWidth={1.5} aria-hidden="true" />,
			media: (
				<AlertsScene
					down={t("emails.alert.heading", {
						monitor: "api.example.com",
						status: t("emails.alert.status.down"),
					})}
					recovered={t("emails.alert.heading", {
						monitor: "api.example.com",
						status: t("emails.alert.status.up"),
					})}
					downLabel={t("statusPage.status.down")}
					upLabel={t("statusPage.status.operational")}
				/>
			),
		},
		{
			title: t("landing.features.list.fourth.title"),
			description: t("landing.features.list.fourth.description"),
			href: routes.marketing.feature.href({ slug: "status-pages" }),
			icon: <GlobeIcon size={20} strokeWidth={1.5} aria-hidden="true" />,
			media: <StatusPageScene banner={t("statusPage.banner.operational")} />,
		},
		{
			title: t("landing.features.list.fifth.title"),
			description: t("landing.features.list.fifth.description"),
			href: routes.marketing.feature.href({ slug: "ssl" }),
			icon: <LockIcon size={20} strokeWidth={1.5} aria-hidden="true" />,
		},
		{
			title: t("landing.features.list.sixth.title"),
			description: t("landing.features.list.sixth.description"),
			href: routes.marketing.feature.href({ slug: "dns" }),
			icon: <LinkIcon size={20} strokeWidth={1.5} aria-hidden="true" />,
		},
		{
			title: t("landing.features.list.seventh.title"),
			description: t("landing.features.list.seventh.description"),
			href: routes.marketing.feature.href({ slug: "integrations" }),
			icon: <MessageSquareIcon size={20} strokeWidth={1.5} aria-hidden="true" />,
		},
		{
			title: t("landing.features.list.eighth.title"),
			description: t("landing.features.list.eighth.description"),
			href: routes.marketing.feature.href({ slug: "flows" }),
			icon: <WorkflowIcon size={20} strokeWidth={1.5} aria-hidden="true" />,
		},
		{
			title: t("landing.features.list.ninth.title"),
			description: t("landing.features.list.ninth.description"),
			href: routes.browserFlows.href(),
			icon: <AppWindowIcon size={20} strokeWidth={1.5} aria-hidden="true" />,
		},
		{
			title: t("landing.footer.sections.docs.mcp"),
			description: t("mcp.meta.description"),
			href: routes.mcp.index.href(),
			icon: <BotIcon size={20} strokeWidth={1.5} aria-hidden="true" />,
		},
	];

	/**
	 * Six of the smaller capabilities, two rows of three. API access is argued by the API
	 * and MCP band above, so it is not repeated here.
	 */
	let CAPABILITIES = [
		{
			key: "maintenanceWindows",
			icon: <CirclePauseIcon size={20} strokeWidth={1.5} aria-hidden="true" />,
		},
		{
			key: "contentMonitoring",
			icon: <FileTextIcon size={20} strokeWidth={1.5} aria-hidden="true" />,
		},
		{
			key: "recoveryAlerts",
			icon: <RefreshCwIcon size={20} strokeWidth={1.5} aria-hidden="true" />,
		},
		{ key: "alertCooldowns", icon: <TimerIcon size={20} strokeWidth={1.5} aria-hidden="true" /> },
		{ key: "customHeaders", icon: <CodeIcon size={20} strokeWidth={1.5} aria-hidden="true" /> },
		{ key: "cronMonitoring", icon: <ClockIcon size={20} strokeWidth={1.5} aria-hidden="true" /> },
	].map((feature) => ({
		icon: feature.icon,
		title: t(`landing.completeFeatureSet.list.${feature.key}.title`),
		description: t(`landing.completeFeatureSet.list.${feature.key}.description`),
	}));

	let USE_CASE_LINKS = [
		{ key: "websiteMonitoring", slug: "website-monitoring" },
		{ key: "apiMonitoring", slug: "api-monitoring" },
		{ key: "saas", slug: "saas" },
		{ key: "microservices", slug: "microservices" },
		{ key: "healthChecks", slug: "healthcheck" },
		{ key: "ecommerce", slug: "ecommerce" },
	].map((useCase) => ({
		href: routes.marketing.useCase.href({ slug: useCase.slug }),
		title: t(`landing.useCases.list.${useCase.key}.title`),
		description: t(`landing.useCases.list.${useCase.key}.description`),
	}));

	/**
	 * The three audiences this row highlights, out of six `/for/:slug` pages — curated so
	 * each reads as a deliberate pick a visitor can act on. The other three stay reachable
	 * through the header's solutions menu, the footer and the sitemap.
	 */
	let AUDIENCE_LINKS = [
		{ key: "agencies", slug: "agencies" },
		{ key: "soloDevelopers", slug: "solo-devs" },
		{ key: "startups", slug: "startups" },
	].map((audience) => ({
		href: routes.marketing.audience.href({ slug: audience.slug }),
		label: t(`landing.useCases.audiences.${audience.key}`),
	}));

	/**
	 * The pricing model's own figures, formatted for the request's locale, for the copy
	 * that quotes them. Interpolating these into the copy keeps `config/pricing.ts` the
	 * only place a price is stated.
	 */
	let pricingCopyValues = {
		price: formatMoney(ctx.locale, BASE_PRICE_USD),
		included: formatCount(ctx.locale, INCLUDED_PINGS),
		blockPrice: formatMoney(ctx.locale, PRICE_PER_BLOCK_USD),
		blockSize: formatCount(ctx.locale, PINGS_PER_BLOCK),
		flowRunPrice: formatMoney(ctx.locale, PRICE_PER_FLOW_RUN_USD * 1000),
	};

	/**
	 * The three reasons to keep reading, stated as checkable product facts: coverage,
	 * usage accounting, and cost. The cost line interpolates {@link pricingCopyValues}.
	 */
	let BENEFITS = [
		{
			key: "everythingIncluded",
			icon: <LayersIcon size={20} strokeWidth={1.5} aria-hidden="true" />,
		},
		{ key: "noMonitorMath", icon: <UsersIcon size={20} strokeWidth={1.5} aria-hidden="true" /> },
		{ key: "payForUsage", icon: <CreditCardIcon size={20} strokeWidth={1.5} aria-hidden="true" /> },
	].map((benefit) => ({
		icon: benefit.icon,
		title: t(`landing.benefits.list.${benefit.key}.title`),
		description: t(`landing.benefits.list.${benefit.key}.description`, pricingCopyValues),
	}));

	/** FAQ entries; the billing answers interpolate {@link pricingCopyValues}. */
	let FAQS = [
		"first",
		"second",
		"third",
		"fourth",
		"fifth",
		"sixth",
		"seventh",
		"eighth",
		"ninth",
		"tenth",
		"eleventh",
		"twelfth",
		"thirteenth",
		"fourteenth",
		"fifteenth",
		"sixteenth",
		"seventeenth",
		"eighteenth",
		"nineteenth",
		"twentieth",
		"twentyFirst",
	].map((key) => ({
		question: t(`landing.faq.list.${key}.q`),
		answer: t(`landing.faq.list.${key}.a`, pricingCopyValues),
	}));

	/**
	 * Split into two balanced accordion columns, the longer half first. Each column's
	 * items carry independent `name`s, so a visitor can open several answers across
	 * columns at once.
	 */
	let faqSplitIndex = Math.ceil(FAQS.length / 2);
	let firstFaqColumn = FAQS.slice(0, faqSplitIndex);
	let secondFaqColumn = FAQS.slice(faqSplitIndex);

	/** A deployment with no site key renders no widget, so its form sends no token. */
	let turnstileSiteKey = trialTurnstileSiteKey();

	/**
	 * The try-it form's honeypot fields, which `/try` verifies before it spends a challenge
	 * verification or a probe. Issuing fails only without a signing secret, which the route's
	 * honeypot middleware always configures.
	 */
	let honeypot = unwrap(await ctx.honeypot.issue());

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={t("landing.meta.title")}
			locale={ctx.locale}
			seo={{
				description: t("landing.meta.description"),
				canonical: SEO.canonical(ctx.url),
				schema: SEO.schema.website(),
			}}
			preload={SCREENSHOT_PRELOADS}
		>
			<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
				<LandingHero
					tone="tinted"
					mediaPlacement="end"
					entrance
					eyebrow={t("landing.hero.pill")}
					eyebrowVariant="pill"
					title={
						<Trans
							intl={ctx.intl}
							i18nKey="landing.hero.title"
							components={{ strong: <AccentText>{""}</AccentText> }}
						/>
					}
					description={t("landing.hero.description")}
					actions={
						<div mix={[vstack({ gap: 4, align: "start" }), is("full")]}>
							<div mix={[inlineFlex(), flexWrap(), items("center"), gap(3)]}>
								<AuthCta
									isSignedIn={isSignedIn}
									dashboardLabel={t("landing.hero.cta.in")}
									startLabel={t("landing.hero.cta.out")}
									icon={<ArrowRightIcon size={20} strokeWidth={1.5} aria-hidden="true" />}
								/>
								<LinkButton href="#pricing" color="neutral" variant="outline" size="lg">
									{t("landing.hero.cta.pricing")}
								</LinkButton>
							</div>
							<CheckList orientation="horizontal">
								{HERO_TRUST_INDICATORS.map((indicator) => (
									<CheckRow key={indicator}>{indicator}</CheckRow>
								))}
							</CheckList>
						</div>
					}
					media={<ProductScreenshot alt={t("landing.hero.screenshot.alt")} />}
				/>

				<MarketingSection spacing="compact" mix={[viewReveal()]}>
					<StatStrip size="display" variant="gap" align="center">
						{PRODUCT_FIGURES.map((figure) => (
							<StatStrip.Item key={figure.label} label={figure.label}>
								{figure.value}
							</StatStrip.Item>
						))}
					</StatStrip>
				</MarketingSection>

				<MarketingSection id="try" spacing="compact" tone="tinted" inset mix={[viewReveal()]}>
					<MarketingHeader description={t("landing.try.description")} align="center">
						{t("landing.try.title")}
					</MarketingHeader>
					<form
						method="post"
						action={routes.trial.check.action.href()}
						mix={[
							vstack({ gap: 3, align: "center" }),
							mi("auto"),
							is("full"),
							maxIs("560px"),
							media("(min-width: 640px)", [flexRow(), items("end"), gap(3)]),
						]}
					>
						<HoneypotFields {...honeypot} />
						<TextField
							name={TRIAL_URL_FIELD}
							type="url"
							label={t("landing.try.label")}
							placeholder={t("landing.try.placeholder")}
							autoComplete="url"
							required
							mix={[grow(1), is("full"), textAlign("start")]}
						/>
						{turnstileSiteKey === null ? null : (
							<TurnstileWidget siteKey={turnstileSiteKey} field={TURNSTILE_FIELD} theme="auto" />
						)}
						<Button type="submit" mix={[shrink(0), nowrap(), bs(10)]}>
							{t("landing.try.submit")}
						</Button>
					</form>
				</MarketingSection>

				<MarketingSection id="benefits" mix={[viewReveal()]}>
					<MarketingHeader
						eyebrow={t("landing.benefits.badge")}
						description={t("landing.benefits.description")}
						align="center"
					>
						{t("landing.benefits.title")}
					</MarketingHeader>
					<Feature.Grid variant="list" columns={3}>
						{BENEFITS.map((benefit) => (
							<Feature key={benefit.title}>
								<Feature.Icon tone="brand">{benefit.icon}</Feature.Icon>
								<Feature.Title>{benefit.title}</Feature.Title>
								<Feature.Description>{benefit.description}</Feature.Description>
							</Feature>
						))}
					</Feature.Grid>
				</MarketingSection>

				<MarketingSection id="features" tone="tinted" mix={[viewReveal()]}>
					<MarketingHeader
						eyebrow={t("landing.features.badge")}
						description={t("landing.features.description")}
						align="center"
					>
						{t("landing.features.title")}
					</MarketingHeader>
					<Feature.Grid columns={3}>
						{FEATURE_LINKS.map((feature) => (
							<Feature key={feature.href} href={feature.href}>
								{"media" in feature ? (
									<Feature.Media>{feature.media}</Feature.Media>
								) : (
									<Feature.Icon>{feature.icon}</Feature.Icon>
								)}
								<Feature.Title>{feature.title}</Feature.Title>
								<Feature.Description>{feature.description}</Feature.Description>
								<Feature.Action>
									<Feature.Link href={feature.href} data-rmx-prefetch="intent">
										{t("landing.features.learnMore")}
									</Feature.Link>
								</Feature.Action>
							</Feature>
						))}
					</Feature.Grid>
				</MarketingSection>

				<FeatureBand
					id="agents"
					layout="split"
					lean="media"
					eyebrow={t("mcp.tools.badge")}
					title={t("mcp.tools.title")}
					description={t("mcp.tools.description")}
					mix={[viewReveal()]}
					media={
						<CodeStage
							variant="code"
							name="uptime-home-api"
							tabs={[
								{ label: "create-monitor.sh", content: CREATE_MONITOR_SH, language: "sh" },
								{ label: "mcp.json", content: MCP_JSON, language: "json" },
							]}
						/>
					}
				>
					<div mix={[vstack({ gap: 6, align: "start" })]}>
						<CheckList>
							<CheckRow>{t("mcp.tools.api")}</CheckRow>
							<CheckRow>{t("mcp.tools.scopes")}</CheckRow>
							<CheckRow>{t("mcp.tools.remote")}</CheckRow>
						</CheckList>
						<LinkButton
							href={routes.mcp.index.href()}
							prefetch="intent"
							color="neutral"
							variant="outline"
						>
							{t("landing.footer.sections.docs.mcp")}
							<ArrowRightIcon size={16} strokeWidth={1.5} aria-hidden="true" />
						</LinkButton>
					</div>
				</FeatureBand>

				<FeatureBand
					id="flows"
					layout="split"
					lean="media"
					eyebrow={t("landing.flows.badge")}
					title={t("landing.flows.title")}
					description={t("landing.flows.description")}
					mix={[viewReveal()]}
					media={
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
					}
				>
					<div mix={[hstack({ gap: 3 }), flexWrap()]}>
						<LinkButton
							href={routes.marketing.feature.href({ slug: "flows" })}
							prefetch="intent"
							color="neutral"
							variant="outline"
						>
							{t("landing.flows.link")}
							<ArrowRightIcon size={16} strokeWidth={1.5} aria-hidden="true" />
						</LinkButton>
						<LinkButton
							href={routes.browserFlows.href()}
							prefetch="intent"
							color="neutral"
							variant="ghost"
						>
							{t("landing.browserExamples.learnMore")}
						</LinkButton>
					</div>
				</FeatureBand>

				<MarketingSection mix={[viewReveal()]}>
					<MarketingHeader
						eyebrow={t("landing.completeFeatureSet.badge")}
						description={t("landing.completeFeatureSet.description")}
						align="center"
					>
						{t("landing.completeFeatureSet.title")}
					</MarketingHeader>
					<Feature.Grid variant="list" columns={3}>
						{CAPABILITIES.map((capability) => (
							<Feature key={capability.title}>
								<Feature.Icon>{capability.icon}</Feature.Icon>
								<Feature.Title>{capability.title}</Feature.Title>
								<Feature.Description>{capability.description}</Feature.Description>
							</Feature>
						))}
					</Feature.Grid>
				</MarketingSection>

				<MarketingSection id="use-cases" tone="tinted" mix={[viewReveal()]}>
					<MarketingHeader
						eyebrow={t("landing.useCases.badge")}
						description={t("landing.useCases.description")}
						align="center"
					>
						{t("landing.useCases.title")}
					</MarketingHeader>
					<Feature.Grid columns={3}>
						{USE_CASE_LINKS.map((useCase) => (
							<Feature key={useCase.href} href={useCase.href}>
								<Feature.Title>{useCase.title}</Feature.Title>
								<Feature.Description>{useCase.description}</Feature.Description>
								<Feature.Action>
									<Feature.Link href={useCase.href} data-rmx-prefetch="intent">
										{t("landing.useCases.learnMore")}
									</Feature.Link>
								</Feature.Action>
							</Feature>
						))}
					</Feature.Grid>
					<div mix={[vstack({ gap: 4, align: "center" }), mbs(12)]}>
						<p mix={[text("sm"), textAlign("center")]}>{t("landing.useCases.tailoredFor")}</p>
						<div mix={[hstack({ gap: 3 }), flexWrap(), justify("center")]}>
							{AUDIENCE_LINKS.map((audience) => (
								<LinkButton
									key={audience.href}
									href={audience.href}
									prefetch="intent"
									color="neutral"
									variant="surface"
								>
									{audience.label}
								</LinkButton>
							))}
						</div>
					</div>
				</MarketingSection>

				<MarketingSection id="pricing" mix={[viewReveal()]}>
					<MarketingHeader
						eyebrow={t("landing.pricing.badge")}
						description={t("landing.pricing.description")}
						align="center"
					>
						{t("landing.pricing.title")}
					</MarketingHeader>
					<IntlProvider intl={ctx.intl}>
						<PricingCalculator initialFrequencies={[10]} />
					</IntlProvider>
				</MarketingSection>

				<FaqBand
					id="faq"
					columns={2}
					tone="tinted"
					eyebrow={t("landing.faq.badge")}
					title={t("landing.faq.title")}
					description={t("landing.faq.description")}
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
