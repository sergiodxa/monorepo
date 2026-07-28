/**
 * Home controller. Renders the public marketing homepage — a split hero with a product
 * screenshot, trust indicators, feature and use-case grids, an interactive usage-based
 * pricing calculator, and a two-column FAQ — inside the shared `MarketingLayout`
 * chrome. It exists as the top-of-funnel entry point for anonymous visitors, and as
 * the redirect target for unauthenticated `requireUser` guards (signed-in viewers see
 * a "Go to dashboard" call to action instead of a sign-in form).
 *
 * The pricing calculator is the one part of this page that ships JavaScript: it's a
 * `clientEntry` island, since a running total that responds to a slider drag can't be
 * expressed server-side. Everything else here is static server-rendered HTML,
 * including the FAQ (native `<details>`).
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
	FileTextIcon,
	GlobeIcon,
	KeyIcon,
	LinkIcon,
	LockIcon,
	MessageSquareIcon,
	RefreshCwIcon,
	ShieldCheckIcon,
	TimerIcon,
	ZapIcon,
} from "@pkg/lucide-remix";
import { Heading, LinkButton } from "@pkg/r3-ui";
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
	inlineFlex,
	insBs,
	insIs,
	items,
	justify,
	relative,
	vstack,
} from "@pkg/u/layout";
import { overflow } from "@pkg/u/overflow";
import { dark, media } from "@pkg/u/responsive";
import { bs, is, m, maxIs, mbe, mbs, mi, p, pb, pi } from "@pkg/u/size";
import { hover } from "@pkg/u/state";
import { translateX, translateY } from "@pkg/u/transform";
import { fontSize, leading, textAlign, textDecoration, tracking, weight } from "@pkg/u/typography";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import { canonicalUrl, getWebSiteSchema } from "~/app/lib/seo";
import AuthCta from "~/resources/components/marketing/auth-cta";
import MarketingCard from "~/resources/components/marketing/card";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import MarketingFeatureRow from "~/resources/components/marketing/feature-row";
import SectionHeader from "~/resources/components/marketing/section-header";
import MarketingTrustIndicators from "~/resources/components/marketing/trust-indicators";
import PricingCalculator from "~/resources/components/pricing-calculator";
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
 * The one/two/three-column ladder every content grid on this page shares.
 *
 * The breakpoints are deliberately identical across sections rather than tuned per
 * grid: `css()` emits each mixin into its own `@layer rmx.<class>`, and layer order
 * follows each class's *first* appearance in the document — so between two
 * overlapping media rules on the same element, the one whose class the page happened
 * to emit later wins, regardless of which breakpoint is narrower. A grid asking for
 * two columns at ≥640px and three at ≥1024px therefore renders two columns at
 * 1280px whenever some earlier section already emitted the 1024px rule. Sharing one
 * ladder keeps every grid's rules in ascending breakpoint order, which is the order
 * the cascade needs them in.
 */
function responsiveGrid() {
	return [
		gridTemplate({ columns: "1fr" }),
		media("(min-width: 768px)", gridTemplate({ columns: "repeat(2, 1fr)" })),
		media("(min-width: 1024px)", gridTemplate({ columns: "repeat(3, 1fr)" })),
	];
}

/**
 * Background for the alternating sections. One palette step off the page's own
 * `--ui-neutral-bg-tint` body color in each scheme, rather than the semantic
 * `bg("neutral.tint")` — that resolves to the *same* token the body already uses,
 * so the alternation it's meant to express renders as no change at all.
 */
function tintedSection() {
	return [bg("color.neutral.100"), dark(bg("color.neutral.900"))];
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

	let TRUST_INDICATORS: TrustIndicator[] = [
		{
			icon: <ZapIcon size={24} strokeWidth={1.5} aria-hidden />,
			value: "99.9%",
			label: t("landing.trustIndicators.uptimeSla"),
		},
		{
			icon: <GlobeIcon size={24} strokeWidth={1.5} aria-hidden />,
			value: "9",
			label: t("landing.trustIndicators.globalRegions"),
		},
		{
			icon: <ShieldCheckIcon size={24} strokeWidth={1.5} aria-hidden />,
			value: "365",
			label: t("landing.trustIndicators.daysDataRetention"),
		},
		{
			icon: <BellIcon size={24} strokeWidth={1.5} aria-hidden />,
			value: "<1s",
			label: t("landing.trustIndicators.alertLatency"),
		},
	];

	let FEATURE_LINKS = [
		{
			title: t("landing.features.list.first.title"),
			description: t("landing.features.list.first.description"),
			slug: "monitors",
			icon: <ActivityIcon size={24} strokeWidth={1.5} aria-hidden />,
		},
		{
			title: t("landing.features.list.second.title"),
			description: t("landing.features.list.second.description"),
			slug: "alerts",
			icon: <BellIcon size={24} strokeWidth={1.5} aria-hidden />,
		},
		{
			title: t("landing.features.list.fourth.title"),
			description: t("landing.features.list.fourth.description"),
			slug: "status-pages",
			icon: <GlobeIcon size={24} strokeWidth={1.5} aria-hidden />,
		},
		{
			title: t("landing.features.list.fifth.title"),
			description: t("landing.features.list.fifth.description"),
			slug: "ssl",
			icon: <LockIcon size={24} strokeWidth={1.5} aria-hidden />,
		},
		{
			title: t("landing.features.list.sixth.title"),
			description: t("landing.features.list.sixth.description"),
			slug: "dns",
			icon: <LinkIcon size={24} strokeWidth={1.5} aria-hidden />,
		},
		{
			title: t("landing.features.list.seventh.title"),
			description: t("landing.features.list.seventh.description"),
			slug: "integrations",
			icon: <MessageSquareIcon size={24} strokeWidth={1.5} aria-hidden />,
		},
	];

	let COMPLETE_FEATURES = [
		{
			key: "maintenanceWindows",
			icon: <CirclePauseIcon size={20} strokeWidth={1.5} aria-hidden />,
		},
		{ key: "contentMonitoring", icon: <FileTextIcon size={20} strokeWidth={1.5} aria-hidden /> },
		{ key: "recoveryAlerts", icon: <RefreshCwIcon size={20} strokeWidth={1.5} aria-hidden /> },
		{ key: "apiAccess", icon: <KeyIcon size={20} strokeWidth={1.5} aria-hidden /> },
		{ key: "alertCooldowns", icon: <TimerIcon size={20} strokeWidth={1.5} aria-hidden /> },
		{ key: "customHeaders", icon: <CodeIcon size={20} strokeWidth={1.5} aria-hidden /> },
		{ key: "cronMonitoring", icon: <ClockIcon size={20} strokeWidth={1.5} aria-hidden /> },
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

	let AUDIENCE_LINKS = [
		{ key: "indieHackers", slug: "indie-hackers" },
		{ key: "soloDevelopers", slug: "solo-devs" },
		{ key: "startups", slug: "startups" },
		{ key: "agencies", slug: "agencies" },
		{ key: "enterprises", slug: "enterprises" },
		{ key: "devops", slug: "devops" },
	].map((audience) => ({
		slug: audience.slug,
		label: t(`landing.useCases.audiences.${audience.key}`),
	}));

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
	].map((key) => ({
		question: t(`landing.faq.list.${key}.q`),
		answer: t(`landing.faq.list.${key}.a`),
	}));

	/** Split into two balanced accordion columns, the longer half first. */
	let faqSplitIndex = Math.ceil(FAQS.length / 2);
	let firstFaqColumn = FAQS.slice(0, faqSplitIndex);
	let secondFaqColumn = FAQS.slice(faqSplitIndex);

	return ctx.render(
		<DocumentLayout
			title={t("landing.meta.title")}
			locale={ctx.locale}
			seo={{
				description: t("landing.meta.description"),
				url: canonicalUrl(ctx.url),
				jsonLd: getWebSiteSchema(),
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
					{/*
					 * Decorative halo behind the hero, centered on its top edge. Its soft
					 * falloff comes from a radial gradient rather than a `blur()` filter —
					 * the named blur scale tops out at 24px, which on an 800px circle reads
					 * as a hard-edged disc rather than a glow.
					 */}
					<div
						aria-hidden
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
										mbs(8),
										media("(min-width: 640px)", [flexRow(), items("center")]),
									]}
								>
									<AuthCta
										isSignedIn={isSignedIn}
										dashboardLabel={t("landing.hero.cta.in")}
										startLabel={t("landing.hero.cta.out")}
										icon={<ArrowRightIcon size={20} strokeWidth={1.5} aria-hidden />}
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
											<CheckIcon size={16} strokeWidth={2} aria-hidden mix={[fg("success")]} />
											{indicator}
										</span>
									))}
								</div>
							</div>

							{/* The product screenshot, one variant per color scheme. */}
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
									// Intrinsic size of both variants, so the hero reserves the
									// right box before the image decodes instead of reflowing.
									width={3216}
									height={2080}
									mix={[block(), is("full"), bs("auto")]}
								/>
							</picture>
						</div>
					</div>
				</section>

				<MarketingTrustIndicators indicators={TRUST_INDICATORS} />

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

						{/* The audience links: one row of pills below the use-case grid. */}
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

						{/* `PricingCalculator` is a `clientEntry` island: its render function runs
						both here (the server pass) and again after hydration, so it reads its copy
						through `intl(handle)` rather than `ctx.i18next` — which needs an
						`IntlProvider` ancestor for `intl(handle)` to resolve at all. */}
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

						{/* Two independent accordion columns — each item opens and closes on its
						own (no shared `name`), so a visitor can compare several answers at once. */}
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
