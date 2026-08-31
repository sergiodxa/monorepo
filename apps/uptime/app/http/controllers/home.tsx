/**
 * Home controller — the public marketing homepage: hero, trust indicators, benefit
 * rows, feature and use-case grids, a pricing calculator, and an FAQ, inside
 * `MarketingLayout`. Serves as the top-of-funnel entry point and the redirect target
 * for unauthenticated `requireUser` guards. The pricing calculator is the page's one
 * `clientEntry` island; the hero's try-it form `POST`s straight to `/try` so the
 * check runs on the first click.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/ui";

import { IntlProvider, Trans } from "@pkg/i18n/ui";
import {
	ActivityIcon,
	ArrowRightIcon,
	BellIcon,
	CheckIcon,
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
} from "@pkg/lucide-remix";
import { bg, border, fg, linearGradient, radialGradient } from "@pkg/u/color";
import { rounded, shadow } from "@pkg/u/effects";
import {
	absolute,
	block,
	flex,
	flexRow,
	flexWrap,
	gap,
	grid,
	gridTemplate,
	grow,
	inlineFlex,
	insBs,
	insIs,
	items,
	justify,
	relative,
	shrink,
	vstack,
} from "@pkg/u/layout";
import { overflow } from "@pkg/u/overflow";
import { dark, media } from "@pkg/u/responsive";
import { bs, is, m, maxIs, mbe, mbs, mi, p, pb, pbe, pbs, pi } from "@pkg/u/size";
import { hover } from "@pkg/u/state";
import { translateX, translateY } from "@pkg/u/transform";
import {
	fontSize,
	leading,
	nowrap,
	textAlign,
	textDecoration,
	tracking,
	weight,
} from "@pkg/u/typography";
import { Button, Heading, LinkButton, TextField } from "@pkg/ui";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import { TRIAL_URL_FIELD } from "~/app/http/validators/trial";
import {
	BASE_PRICE_USD,
	INCLUDED_PINGS,
	PINGS_PER_BLOCK,
	PRICE_PER_BLOCK_USD,
} from "~/app/lib/pricing";
import { SEO } from "~/app/lib/seo";
import { trialTurnstileSiteKey } from "~/app/services/trial-guard";
import AuthCta from "~/resources/components/marketing/auth-cta";
import MarketingCard from "~/resources/components/marketing/card";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import MarketingFeatureRow from "~/resources/components/marketing/feature-row";
import SectionHeader from "~/resources/components/marketing/section-header";
import MarketingTrustIndicators from "~/resources/components/marketing/trust-indicators";
import PricingCalculator from "~/resources/components/pricing-calculator";
import Turnstile from "~/resources/components/turnstile";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** Light-mode hero screenshot, also the `<img>` fallback for engines without `<picture>` support. */
const SCREENSHOT_LIGHT = "/screenshot-light.webp";

/** Dark-mode hero screenshot, selected by the `<source>` media condition. */
const SCREENSHOT_DARK = "/screenshot-dark.webp";

/**
 * Vertical section padding shared by every full-width section: 64px, growing to
 * 96px at ≥640px and 128px at ≥1024px.
 */
function sectionPadding() {
	return [pb(16), media("(min-width: 640px)", pb(24)), media("(min-width: 1024px)", pb(32))];
}

/**
 * Centered content wrapper shared by every section: capped at 1152px, horizontally
 * centered, with 16/24/32px side padding by breakpoint.
 */
function marketingContainer() {
	return [
		maxIs("1152px"),
		mi("auto"),
		pi(4),
		media("(min-width: 640px)", pi(6)),
		media("(min-width: 1024px)", pi(8)),
	];
}

/**
 * The one/two/three-column ladder every content grid on this page shares. Grids
 * list breakpoints in ascending order because `css()` layers mixins by first
 * appearance, and layer order decides which overlapping media rule wins.
 */
function responsiveGrid() {
	return [
		gridTemplate({ columns: "1fr" }),
		media("(min-width: 768px)", gridTemplate({ columns: "repeat(2, 1fr)" })),
		media("(min-width: 1024px)", gridTemplate({ columns: "repeat(3, 1fr)" })),
	];
}

/**
 * Background for the alternating sections: one palette step off the page's own
 * `--ui-neutral-bg-tint` body color in each scheme, so the alternation stays visible
 * against a body already painted with the semantic `neutral.tint` token.
 */
function tintedSection() {
	return [bg("color.neutral.100"), dark(bg("color.neutral.900"))];
}

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
	let chrome = buildMarketingChrome(ctx.i18next.t);
	let t = ctx.i18next.t;

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
			slug: "monitors",
			icon: <ActivityIcon size={24} strokeWidth={1.5} />,
		},
		{
			title: t("landing.features.list.second.title"),
			description: t("landing.features.list.second.description"),
			slug: "alerts",
			icon: <BellIcon size={24} strokeWidth={1.5} />,
		},
		{
			title: t("landing.features.list.fourth.title"),
			description: t("landing.features.list.fourth.description"),
			slug: "status-pages",
			icon: <GlobeIcon size={24} strokeWidth={1.5} />,
		},
		{
			title: t("landing.features.list.fifth.title"),
			description: t("landing.features.list.fifth.description"),
			slug: "ssl",
			icon: <LockIcon size={24} strokeWidth={1.5} />,
		},
		{
			title: t("landing.features.list.sixth.title"),
			description: t("landing.features.list.sixth.description"),
			slug: "dns",
			icon: <LinkIcon size={24} strokeWidth={1.5} />,
		},
		{
			title: t("landing.features.list.seventh.title"),
			description: t("landing.features.list.seventh.description"),
			slug: "integrations",
			icon: <MessageSquareIcon size={24} strokeWidth={1.5} />,
		},
		{
			title: t("landing.features.list.eighth.title"),
			description: t("landing.features.list.eighth.description"),
			slug: "flows",
			icon: <WorkflowIcon size={24} strokeWidth={1.5} />,
		},
	];

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
	 * copy that quotes them. Interpolating these into the copy keeps `app/lib/pricing.ts`
	 * the only place a price is stated.
	 */
	let pricingCopyValues = {
		price: formatMoney(ctx.locale, BASE_PRICE_USD),
		included: formatCount(ctx.locale, INCLUDED_PINGS),
		blockPrice: formatMoney(ctx.locale, PRICE_PER_BLOCK_USD),
		blockSize: formatCount(ctx.locale, PINGS_PER_BLOCK),
	};

	/**
	 * The three reasons to keep reading, stated as checkable product facts: coverage,
	 * usage accounting, and cost. The cost line interpolates {@link pricingCopyValues},
	 * keeping `app/lib/pricing.ts` the only place a price is stated.
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

	return ctx.render(
		<DocumentLayout
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
				<section
					mix={[
						...sectionPadding(),
						relative(),
						overflow("hidden"),
						bg({
							image: linearGradient(
								"to bottom",
								"var(--ui-brand-bg-tint)",
								"var(--ui-neutral-bg-tint)",
							),
						}),
					]}
				>
					<div
						aria-hidden="true"
						mix={[
							absolute(),
							insBs(0),
							insIs("50%"),
							is("800px"),
							bs("800px"),
							translateX("-50%"),
							translateY("-50%"),
							bg({
								image: radialGradient(
									"circle closest-side",
									{ color: "var(--ui-brand-bg-tint)", position: "0%" },
									{ color: "transparent", position: "100%" },
								),
							}),
						]}
					/>

					<div mix={[...marketingContainer(), relative()]}>
						<div
							mix={[
								grid(),
								gap(12),
								items("center"),
								media("(min-width: 1024px)", [
									gridTemplate({ columns: "repeat(2, 1fr)" }),
									gap(16),
								]),
							]}
						>
							<div
								mix={[
									vstack({ align: "center" }),
									textAlign("center"),
									media("(min-width: 1024px)", [items("start"), textAlign("start")]),
								]}
							>
								<span
									mix={[
										inlineFlex(),
										items("center"),
										p("2px", "10px"),
										rounded("999px"),
										fontSize("xs"),
										weight(600),
										border({ color: "brand", width: 1 }),
										bg("brand.tint"),
										fg("brand"),
										mbe(6),
									]}
								>
									{t("landing.hero.pill")}
								</span>

								<Heading
									level={1}
									mix={[
										m(0),
										fontSize("4xl"),
										weight(700),
										leading(1.1),
										tracking("tight"),
										maxIs("760px"),
										media("(min-width: 640px)", fontSize("5xl")),
										media("(min-width: 1024px)", fontSize("6xl")),
									]}
								>
									<Trans
										i18n={ctx.i18next}
										i18nKey="landing.hero.title"
										components={{ strong: <span mix={[fg("brand")]} /> }}
									/>
								</Heading>

								<p
									mix={[
										m(0),
										mbs(6),
										maxIs("576px"),
										fontSize("lg"),
										leading(1.625),
										fg("neutral"),
									]}
								>
									{t("landing.hero.description")}
								</p>

								<div
									mix={[
										vstack({ gap: 4, align: "center" }),
										mbs(6),
										media("(min-width: 640px)", [flexRow(), items("center")]),
									]}
								>
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

								<div
									mix={[
										flex(),
										flexWrap("wrap"),
										justify("center"),
										gap(2, 6),
										mbs(8),
										media("(min-width: 1024px)", justify("start")),
									]}
								>
									{HERO_TRUST_INDICATORS.map((indicator) => (
										<span
											key={indicator}
											mix={[
												inlineFlex(),
												items("center"),
												gap("6px"),
												fontSize("sm"),
												fg("neutral.muted"),
											]}
										>
											<CheckIcon size={16} strokeWidth={2} mix={[fg("success")]} />
											{indicator}
										</span>
									))}
								</div>
							</div>

							<picture
								mix={[
									block(),
									relative(),
									overflow("hidden"),
									rounded("xl"),
									shadow("xl"),
									border({ color: "neutral", width: 1 }),
								]}
							>
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
						</div>
					</div>
				</section>

				<section id="try" mix={[pbs(0), pbe(10), media("(min-width: 1024px)", pbe(14))]}>
					<div mix={[...marketingContainer(), vstack({ gap: 4, align: "center" })]}>
						<Heading level={2} mix={[m(0), fontSize("2xl"), textAlign("center")]}>
							{t("landing.try.title")}
						</Heading>
						<p mix={[m(0), maxIs("560px"), textAlign("center"), fontSize("sm"), fg("neutral")]}>
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
							<TextField
								name={TRIAL_URL_FIELD}
								type="url"
								label={t("landing.try.label")}
								placeholder={t("landing.try.placeholder")}
								autoComplete="url"
								required
								mix={[grow(1), is("full"), textAlign("start")]}
							/>
							<Turnstile siteKey={trialTurnstileSiteKey()} />
							<Button type="submit" mix={[shrink(0), nowrap(), bs(10)]}>
								{t("landing.try.submit")}
							</Button>
						</form>
					</div>
				</section>

				<MarketingTrustIndicators indicators={TRUST_INDICATORS} />

				<section id="benefits" mix={[...sectionPadding()]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader
							badge={t("landing.benefits.badge")}
							title={t("landing.benefits.title")}
							description={t("landing.benefits.description")}
						/>

						<div mix={[grid(), gap(6), ...responsiveGrid()]}>
							{BENEFITS.map((benefit) => (
								<MarketingFeatureRow
									key={benefit.title}
									icon={benefit.icon}
									title={benefit.title}
									description={benefit.description}
								/>
							))}
						</div>
					</div>
				</section>

				<section id="features" mix={[...sectionPadding()]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader
							badge={t("landing.features.badge")}
							title={t("landing.features.title")}
							description={t("landing.features.description")}
						/>

						<div mix={[grid(), gap(8), ...responsiveGrid()]}>
							{FEATURE_LINKS.map((feature) => (
								<MarketingCard
									key={feature.slug}
									href={routes.marketing.feature.href({ slug: feature.slug })}
									icon={feature.icon}
									title={feature.title}
									description={feature.description}
									learnMore={t("landing.features.learnMore")}
								/>
							))}
						</div>
					</div>
				</section>

				<section mix={[...sectionPadding()]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader
							badge={t("landing.completeFeatureSet.badge")}
							title={t("landing.completeFeatureSet.title")}
							description={t("landing.completeFeatureSet.description")}
						/>

						<div mix={[grid(), gap(6), ...responsiveGrid()]}>
							{COMPLETE_FEATURES.map((feature) => (
								<MarketingFeatureRow
									key={feature.title}
									icon={feature.icon}
									title={feature.title}
									description={feature.description}
								/>
							))}
						</div>
					</div>
				</section>

				<section mix={[...sectionPadding(), ...tintedSection()]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader
							badge={t("landing.useCases.badge")}
							title={t("landing.useCases.title")}
							description={t("landing.useCases.description")}
						/>

						<div mix={[grid(), gap(6), ...responsiveGrid()]}>
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
					</div>
				</section>

				<section id="pricing" mix={[...sectionPadding(), ...tintedSection()]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader
							badge={t("landing.pricing.badge")}
							title={t("landing.pricing.title")}
							description={t("landing.pricing.description")}
						/>

						<IntlProvider i18n={ctx.i18next}>
							<PricingCalculator initialFrequencies={[10]} />
						</IntlProvider>
					</div>
				</section>

				<section id="faq" mix={[...sectionPadding()]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader
							badge={t("landing.faq.badge")}
							title={t("landing.faq.title")}
							description={t("landing.faq.description")}
						/>

						<div
							mix={[
								grid(),
								gap(8),
								items("start"),
								media("(min-width: 1024px)", gridTemplate({ columns: "repeat(2, 1fr)" })),
							]}
						>
							<FaqAccordion items={firstFaqColumn} />
							<FaqAccordion items={secondFaqColumn} />
						</div>
					</div>
				</section>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
