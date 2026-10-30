/**
 * Home controller — the public marketing homepage: hero, trust indicators, benefit
 * rows, feature and use-case grids, browser-flow examples, a pricing calculator, and
 * an FAQ, inside `MarketingLayout`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { TurnstileWidget } from "@sdxc/captcha/turnstile/ui";
import { HoneypotFields } from "@sdxc/honeypot/ui";
import { IntlProvider, Trans } from "@sdxc/i18n/ui";
import {
	ActivityIcon,
	AppWindowIcon,
	ArrowRightIcon,
	BellIcon,
	CirclePauseIcon,
	ClockIcon,
	CodeIcon,
	CreditCardIcon,
	FileTextIcon,
	GlobeIcon,
	KeyIcon,
	LayersIcon,
	LinkIcon,
	LockIcon,
	MessageSquareIcon,
	RefreshCwIcon,
	ShieldCheckIcon,
	TimerIcon,
	UsersIcon,
	WorkflowIcon,
} from "@sdxc/icons";
import { unwrap } from "@sdxc/result";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import {
	block,
	flex,
	flexRow,
	flexWrap,
	gap,
	grid,
	gridTemplate,
	grow,
	inlineFlex,
	items,
	justify,
	shrink,
	vstack,
} from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { dark, media } from "@sdxc/u/responsive";
import { bs, is, m, maxIs, mbs, mi, p } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import {
	font,
	fontSize,
	leading,
	nowrap,
	textAlign,
	textDecoration,
	weight,
	whiteSpace,
} from "@sdxc/u/typography";
import {
	Button,
	Heading,
	HeadingScope,
	LinkButton,
	MarketingHeader,
	MarketingSection,
	TextField,
} from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import {
	AccentText,
	Bento,
	CheckList,
	CheckRow,
	FaqBand,
	FeatureBand,
	IconWell,
	LandingHero,
	ProductFrame,
} from "@sdxc/ui/patterns";
import { createAction } from "remix/router";

/**
 * The one/two/three-column ladder mid-page content grids share when they are
 * not {@link Feature.Grid} cells (browser-flow samples, audience pills).
 */
function contentGrid() {
	return [
		grid(),
		gap(8),
		gridTemplate({ columns: "1fr" }),
		media("(min-width: 768px)", gridTemplate({ columns: "repeat(2, 1fr)" })),
		media("(min-width: 1024px)", gridTemplate({ columns: "repeat(3, 1fr)" })),
	];
}

import { getViewer } from "~/app/http/middleware/auth";
import { TRIAL_URL_FIELD, TURNSTILE_FIELD } from "~/app/http/validators/trial";
import { SEO } from "~/app/initializers/seo";
import { trialTurnstileSiteKey } from "~/app/services/trial/guard";
import {
	BASE_PRICE_USD,
	INCLUDED_PINGS,
	PINGS_PER_BLOCK,
	PRICE_PER_BLOCK_USD,
	PRICE_PER_FLOW_RUN_USD,
} from "~/config/pricing";
import AuthCta from "~/resources/components/marketing/auth-cta";
import MarketingCard from "~/resources/components/marketing/card";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import MarketingTrustIndicators from "~/resources/components/marketing/trust-indicators";
import PricingCalculator from "~/resources/components/pricing-calculator";
import { BROWSER_FLOW_EXAMPLES } from "~/resources/content/browser-flows";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** Light-mode hero screenshot, also the `<img>` fallback for engines without `<picture>` support. */
const SCREENSHOT_LIGHT = "/screenshot-light.webp";

/** Dark-mode hero screenshot, selected by the `<source>` media condition. */
const SCREENSHOT_DARK = "/screenshot-dark.webp";

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

/** One headline figure in the trust-indicator strip below the hero. */
interface TrustIndicator {
	icon: RemixNode;
	value: string;
	label: string;
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
	 * Each value is a verifiable product spec, chosen so every figure in this strip
	 * can be checked against real behavior. "1min" is the enforced check-interval
	 * floor: `interval_seconds` carries a 60-second minimum in validation.
	 */
	let TRUST_INDICATORS: TrustIndicator[] = [
		{
			icon: <ActivityIcon size={24} strokeWidth={1.5} />,
			value: "6",
			label: t("landing.trustIndicators.monitorTypes"),
		},
		{
			icon: <GlobeIcon size={24} strokeWidth={1.5} />,
			value: "9",
			label: t("landing.trustIndicators.globalRegions"),
		},
		{
			icon: <ShieldCheckIcon size={24} strokeWidth={1.5} />,
			value: "365",
			label: t("landing.trustIndicators.daysDataRetention"),
		},
		{
			icon: <ClockIcon size={24} strokeWidth={1.5} />,
			value: "1min",
			label: t("landing.trustIndicators.minCheckInterval"),
		},
	];

	let FEATURE_LINKS = [
		{
			title: t("landing.features.list.first.title"),
			description: t("landing.features.list.first.description"),
			href: routes.marketing.feature.href({ slug: "monitors" }),
			icon: <ActivityIcon size={24} strokeWidth={1.5} />,
		},
		{
			title: t("landing.features.list.second.title"),
			description: t("landing.features.list.second.description"),
			href: routes.marketing.feature.href({ slug: "alerts" }),
			icon: <BellIcon size={24} strokeWidth={1.5} />,
		},
		{
			title: t("landing.features.list.fourth.title"),
			description: t("landing.features.list.fourth.description"),
			href: routes.marketing.feature.href({ slug: "status-pages" }),
			icon: <GlobeIcon size={24} strokeWidth={1.5} />,
		},
		{
			title: t("landing.features.list.fifth.title"),
			description: t("landing.features.list.fifth.description"),
			href: routes.marketing.feature.href({ slug: "ssl" }),
			icon: <LockIcon size={24} strokeWidth={1.5} />,
		},
		{
			title: t("landing.features.list.sixth.title"),
			description: t("landing.features.list.sixth.description"),
			href: routes.marketing.feature.href({ slug: "dns" }),
			icon: <LinkIcon size={24} strokeWidth={1.5} />,
		},
		{
			title: t("landing.features.list.seventh.title"),
			description: t("landing.features.list.seventh.description"),
			href: routes.marketing.feature.href({ slug: "integrations" }),
			icon: <MessageSquareIcon size={24} strokeWidth={1.5} />,
		},
		{
			title: t("landing.features.list.eighth.title"),
			description: t("landing.features.list.eighth.description"),
			href: routes.marketing.feature.href({ slug: "flows" }),
			icon: <WorkflowIcon size={24} strokeWidth={1.5} />,
		},
		{
			title: t("landing.features.list.ninth.title"),
			description: t("landing.features.list.ninth.description"),
			href: routes.browserFlows.href(),
			icon: <AppWindowIcon size={24} strokeWidth={1.5} />,
		},
	];

	let BROWSER_EXAMPLES = BROWSER_FLOW_EXAMPLES.map((example) => ({
		key: example.key,
		title: t(`landing.browserExamples.list.${example.key}.title`),
		description: t(`landing.browserExamples.list.${example.key}.description`),
		source: example.source,
	}));

	let COMPLETE_FEATURES = [
		{
			key: "maintenanceWindows",
			icon: <CirclePauseIcon size={20} strokeWidth={1.5} />,
		},
		{ key: "contentMonitoring", icon: <FileTextIcon size={20} strokeWidth={1.5} /> },
		{ key: "recoveryAlerts", icon: <RefreshCwIcon size={20} strokeWidth={1.5} /> },
		{ key: "apiAccess", icon: <KeyIcon size={20} strokeWidth={1.5} /> },
		{ key: "alertCooldowns", icon: <TimerIcon size={20} strokeWidth={1.5} /> },
		{ key: "customHeaders", icon: <CodeIcon size={20} strokeWidth={1.5} /> },
		{ key: "cronMonitoring", icon: <ClockIcon size={20} strokeWidth={1.5} /> },
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
		slug: useCase.slug,
		title: t(`landing.useCases.list.${useCase.key}.title`),
		description: t(`landing.useCases.list.${useCase.key}.description`),
	}));

	/**
	 * The three audiences this row highlights, out of six `/for/:slug` pages —
	 * curated so each pill reads as a deliberate pick a visitor can act on. The
	 * other three stay reachable through the footer's solutions column and the sitemap.
	 */
	let AUDIENCE_LINKS = [
		{ key: "agencies", slug: "agencies" },
		{ key: "soloDevelopers", slug: "solo-devs" },
		{ key: "startups", slug: "startups" },
	].map((audience) => ({
		slug: audience.slug,
		label: t(`landing.useCases.audiences.${audience.key}`),
	}));

	/**
	 * The pricing model's own figures, formatted for the request's locale, for the
	 * copy that quotes them. Interpolating these into the copy keeps `config/pricing.ts`
	 * the only place a price is stated.
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
	 * usage accounting, and cost. The cost line interpolates {@link pricingCopyValues},
	 * keeping `config/pricing.ts` the only place a price is stated.
	 */
	let BENEFITS = [
		{
			key: "everythingIncluded",
			icon: <LayersIcon size={20} strokeWidth={1.5} />,
		},
		{ key: "noMonitorMath", icon: <UsersIcon size={20} strokeWidth={1.5} /> },
		{ key: "payForUsage", icon: <CreditCardIcon size={20} strokeWidth={1.5} /> },
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
			preload={[
				{ href: SCREENSHOT_LIGHT, as: "image", media: "(prefers-color-scheme: light)" },
				{ href: SCREENSHOT_DARK, as: "image", media: "(prefers-color-scheme: dark)" },
			]}
		>
			<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
				<LandingHero
					tone="tinted"
					mediaPlacement="end"
					eyebrow={t("landing.hero.pill")}
					eyebrowVariant="pill"
					mix={[viewReveal()]}
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
									icon={<ArrowRightIcon size={20} strokeWidth={1.5} />}
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
					media={
						<ProductFrame lights>
							<picture mix={[block(), overflow("hidden")]}>
								<source media="(prefers-color-scheme: dark)" srcSet={SCREENSHOT_DARK} />
								<source media="(prefers-color-scheme: light)" srcSet={SCREENSHOT_LIGHT} />
								<img
									src={SCREENSHOT_LIGHT}
									alt={t("landing.hero.screenshot.alt")}
									width={3216}
									height={2080}
									mix={[block(), is("full"), bs("auto")]}
								/>
							</picture>
						</ProductFrame>
					}
				/>

				<MarketingSection id="try" spacing="compact" align="center" mix={[viewReveal()]}>
					<Heading mix={[m(0), fontSize("2xl"), textAlign("center")]}>
						{t("landing.try.title")}
					</Heading>
					<p
						mix={[m(0), mbs(4), maxIs("560px"), textAlign("center"), fontSize("sm"), fg("neutral")]}
					>
						{t("landing.try.description")}
					</p>

					<form
						method="post"
						action={routes.trial.check.action.href()}
						mix={[
							vstack({ gap: 3, align: "center" }),
							mbs(2),
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

				<MarketingTrustIndicators indicators={TRUST_INDICATORS} mix={[viewReveal()]} />

				<MarketingSection id="benefits" mix={[viewReveal()]}>
					<MarketingHeader
						eyebrow={t("landing.benefits.badge")}
						description={t("landing.benefits.description")}
						align="center"
					>
						{t("landing.benefits.title")}
					</MarketingHeader>
					<Bento columns={3}>
						{BENEFITS.map((benefit) => (
							<Bento.Cell key={benefit.title}>
								<IconWell size="sm" aria-hidden="true">
									{benefit.icon}
								</IconWell>
								<Bento.Title>{benefit.title}</Bento.Title>
								<Bento.Body>{benefit.description}</Bento.Body>
							</Bento.Cell>
						))}
					</Bento>
				</MarketingSection>

				<FeatureBand
					id="features"
					layout="split"
					lean="media"
					eyebrow={t("landing.features.badge")}
					title={t("landing.features.title")}
					description={t("landing.features.description")}
					mix={[viewReveal()]}
					media={
						<ProductFrame lights>
							<picture mix={[block(), overflow("hidden")]}>
								<source media="(prefers-color-scheme: dark)" srcSet={SCREENSHOT_DARK} />
								<source media="(prefers-color-scheme: light)" srcSet={SCREENSHOT_LIGHT} />
								<img
									src={SCREENSHOT_LIGHT}
									alt={t("landing.hero.screenshot.alt")}
									width={3216}
									height={2080}
									mix={[block(), is("full"), bs("auto")]}
								/>
							</picture>
						</ProductFrame>
					}
				>
					<ul>
						{FEATURE_LINKS.slice(0, 5).map((feature) => (
							<li key={feature.href}>{feature.title}</li>
						))}
					</ul>
				</FeatureBand>

				<MarketingSection spacing="compact" mix={[viewReveal()]}>
					<Bento columns={4}>
						{FEATURE_LINKS.map((feature) => (
							<Bento.Cell key={feature.href}>
								<a
									href={feature.href}
									data-rmx-prefetch="intent"
									mix={[
										vstack({ gap: 3, align: "stretch" }),
										bs("full"),
										textDecoration("none"),
										fg("inherit"),
									]}
								>
									<IconWell size="sm" aria-hidden="true">
										{feature.icon}
									</IconWell>
									<Bento.Title>{feature.title}</Bento.Title>
									<Bento.Body>{feature.description}</Bento.Body>
									<span
										mix={[
											inlineFlex(),
											items("center"),
											gap(1),
											fontSize("sm"),
											weight(500),
											fg("brand"),
										]}
									>
										{t("landing.features.learnMore")}
										<ArrowRightIcon size={16} strokeWidth={1.5} />
									</span>
								</a>
							</Bento.Cell>
						))}
					</Bento>
				</MarketingSection>

				<MarketingSection id="browser-flows" tone="tinted" mix={[viewReveal()]}>
					<MarketingHeader
						eyebrow={t("landing.browserExamples.badge")}
						description={t("landing.browserExamples.description")}
						align="center"
					>
						{t("landing.browserExamples.title")}
					</MarketingHeader>

					<div mix={[...contentGrid()]}>
						{BROWSER_EXAMPLES.map((example) => (
							<article
								key={example.key}
								mix={[
									vstack({ gap: 4 }),
									p(5),
									rounded("xl"),
									border({ color: "neutral", width: 1 }),
									bg("neutral.tint"),
								]}
							>
								<div mix={[vstack({ gap: 2 })]}>
									<HeadingScope level={3}>
										<Heading mix={[m(0), fontSize("lg"), weight(600)]}>{example.title}</Heading>
									</HeadingScope>
									<p mix={[m(0), fontSize("sm"), leading("relaxed"), fg("neutral")]}>
										{example.description}
									</p>
								</div>
								<pre
									mix={[
										m(0),
										p(4),
										rounded("lg"),
										bg("color.neutral.900"),
										dark(bg("color.neutral.950")),
										fg("color.neutral.100"),
										font("mono"),
										fontSize("xs"),
										leading("relaxed"),
										whiteSpace("pre"),
										overflow("auto"),
									]}
								>
									<code>{example.source}</code>
								</pre>
							</article>
						))}
					</div>

					<div mix={[mbs(8), flex(), justify("center")]}>
						<a
							href={routes.browserFlows.href()}
							data-rmx-prefetch="intent"
							mix={[
								inlineFlex(),
								items("center"),
								gap(2),
								fontSize("sm"),
								weight(600),
								fg("brand"),
								textDecoration("none"),
								hover([textDecoration("underline")]),
							]}
						>
							{t("landing.browserExamples.learnMore")}
							<ArrowRightIcon size={16} strokeWidth={1.5} />
						</a>
					</div>
				</MarketingSection>

				<MarketingSection mix={[viewReveal()]}>
					<MarketingHeader
						eyebrow={t("landing.completeFeatureSet.badge")}
						description={t("landing.completeFeatureSet.description")}
						align="center"
					>
						{t("landing.completeFeatureSet.title")}
					</MarketingHeader>
					<Bento columns={3}>
						{COMPLETE_FEATURES.map((feature) => (
							<Bento.Cell key={feature.title}>
								<IconWell size="sm" aria-hidden="true">
									{feature.icon}
								</IconWell>
								<Bento.Title>{feature.title}</Bento.Title>
								<Bento.Body>{feature.description}</Bento.Body>
							</Bento.Cell>
						))}
					</Bento>
				</MarketingSection>

				<MarketingSection tone="tinted" mix={[viewReveal()]}>
					<MarketingHeader
						eyebrow={t("landing.useCases.badge")}
						description={t("landing.useCases.description")}
						align="center"
					>
						{t("landing.useCases.title")}
					</MarketingHeader>

					<div mix={[...contentGrid(), gap(6)]}>
						{USE_CASE_LINKS.map((useCase) => (
							<MarketingCard
								key={useCase.slug}
								href={routes.marketing.useCase.href({ slug: useCase.slug })}
								title={useCase.title}
								description={useCase.description}
								learnMore={t("landing.useCases.learnMore")}
							/>
						))}
					</div>

					<div
						mix={[
							mbs(12),
							p(6),
							rounded("xl"),
							border({ color: "neutral", width: 1 }),
							bg("neutral.tint"),
							textAlign("center"),
						]}
					>
						<p mix={[m(0), fontSize("sm"), weight(600), fg("neutral.emphasis")]}>
							{t("landing.useCases.tailoredFor")}
						</p>
						<div mix={[flex(), flexWrap("wrap"), justify("center"), gap(3), mbs(4)]}>
							{AUDIENCE_LINKS.map((audience) => (
								<a
									key={audience.slug}
									href={routes.marketing.audience.href({ slug: audience.slug })}
									data-rmx-prefetch="intent"
									mix={[
										inlineFlex(),
										items("center"),
										p(2, 4),
										rounded("999px"),
										border({ color: "neutral", width: 1 }),
										bg("color.neutral.100"),
										dark(bg("color.neutral.800")),
										fontSize("sm"),
										weight(500),
										fg("neutral"),
										textDecoration("none"),
										hover([border("brand"), bg("brand.tint"), fg("brand")]),
									]}
								>
									{audience.label}
								</a>
							))}
						</div>
					</div>
				</MarketingSection>

				<MarketingSection id="pricing" tone="tinted" mix={[viewReveal()]}>
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
					eyebrow={t("landing.faq.badge")}
					title={t("landing.faq.title")}
					description={t("landing.faq.description")}
					mix={[viewReveal()]}
				>
					<FaqAccordion items={firstFaqColumn} />
					<FaqAccordion items={secondFaqColumn} />
				</FaqBand>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
