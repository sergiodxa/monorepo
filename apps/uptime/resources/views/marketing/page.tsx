/**
 * Generic marketing page view shared by `/features/:slug`, `/for/:slug`, and
 * `/use-cases/:slug`. Renders a split hero (copy plus the product screenshot), the
 * page's own trust-indicator strip, a feature grid, a numbered "how it works" row, a
 * two-column FAQ accordion (native `<details>`, no client JS), and a final call to
 * action. It exists so those three route families reuse one view instead of
 * near-duplicate ones, driven entirely by `resources/content/marketing.ts` data plus
 * a handful of translated section titles the calling controller threads through as
 * plain props (the same convention `AppShell` uses for its own `heading`/`breadcrumbs`
 * props).
 *
 * Those translated props are built by {@link buildMarketingPageChrome}, exported from
 * here so all three controllers share one set of `t()` calls instead of repeating a
 * dozen of them three times over — the same split `resources/layouts/marketing.tsx`
 * makes with its own `buildMarketingChrome`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";
import type { Handle } from "remix/ui";

import { ArrowRightIcon, CheckIcon, Icon } from "@pkg/lucide-remix";
import { Heading, LinkButton } from "@pkg/r3-ui";
import { bg, border, fg, linearGradient, radialGradient } from "@pkg/u/color";
import { opacity, rounded, shadow } from "@pkg/u/effects";
import { counterReset } from "@pkg/u/general";
import {
	absolute,
	block,
	flex,
	flexCol,
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
import { translateX, translateY } from "@pkg/u/transform";
import { fontSize, leading, textAlign, tracking, weight } from "@pkg/u/typography";

import type { MarketingContent } from "~/resources/content/marketing";

import AuthCta from "~/resources/components/marketing/auth-cta";
import MarketingCard from "~/resources/components/marketing/card";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import SectionHeader from "~/resources/components/marketing/section-header";
import MarketingStep from "~/resources/components/marketing/step";
import MarketingTrustIndicators from "~/resources/components/marketing/trust-indicators";
import routes from "~/routes/web";

/** Light-mode hero screenshot, also the `<img>` fallback for engines without `<picture>` support. */
export const SCREENSHOT_LIGHT = "/screenshot-light.webp";

/** Dark-mode hero screenshot, selected by the `<source>` media condition. */
export const SCREENSHOT_DARK = "/screenshot-dark.webp";

/**
 * Vertical section padding shared by every full-width section: 64px, growing
 * to 96px at ≥640px and 128px at ≥1024px.
 */
function sectionPadding() {
	return [pb(16), media("(min-width: 640px)", pb(24)), media("(min-width: 1024px)", pb(32))];
}

/**
 * Centered content wrapper shared by every section: capped at 1152px,
 * horizontally centered, with 16/24/32px side padding by breakpoint.
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
 * to emit later wins, regardless of which breakpoint is narrower. Sharing one ladder
 * keeps every grid's rules in ascending breakpoint order, which is the order the
 * cascade needs them in.
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

/**
 * The CTA button row: stacked and centered below 640px, side-by-side and
 * centered at ≥640px.
 */
function ctaRow() {
	return [
		flex(),
		flexCol(),
		items("center"),
		gap(4),
		mbs(8),
		media("(min-width: 640px)", [flexRow(), justify("center")]),
	];
}

namespace MarketingPageView {
	/** Adds `isSignedIn` (drives the CTA's copy/target) and the translated section titles/CTA copy on top of the raw marketing-page content shape. */
	export interface Props extends MarketingContent.Page, Chrome {
		isSignedIn: boolean;
	}

	/**
	 * The page-agnostic, already-translated chrome every marketing page renders
	 * around its own content: section badges/titles/descriptions, CTA labels, and
	 * the screenshot's alternative text. Built by {@link buildMarketingPageChrome}.
	 */
	export interface Chrome {
		/** Label for the signed-out CTA button (`landing.hero.cta.out`). */
		startLabel: string;
		/** Label for the signed-in CTA link (`landing.hero.cta.in`). */
		dashboardLabel: string;
		/** Label for the hero's secondary CTA, linking to the homepage's pricing calculator (`landing.hero.cta.pricing`). */
		pricingLabel: string;
		/** Alternative text for the hero's product screenshot (`landing.hero.screenshot.alt`). */
		screenshotAlt: string;
		/** Eyebrow badge above the feature grid (`landing.marketingPage.everythingBadge`). */
		everythingBadge: string;
		/** Title for the feature-grid section (`landing.marketingPage.everythingTitle`). */
		everythingTitle: string;
		/** Lead paragraph below the feature-grid title (`landing.marketingPage.everythingDescription`). */
		everythingDescription: string;
		/** Eyebrow badge above the numbered "how it works" section (`landing.marketingPage.howItWorksBadge`). */
		howItWorksBadge: string;
		/** Title for the numbered "how it works" section (`landing.marketingPage.howItWorksTitle`). */
		howItWorksTitle: string;
		/** Lead paragraph below the "how it works" title (`landing.marketingPage.howItWorksDescription`). */
		howItWorksDescription: string;
		/** Eyebrow badge above the FAQ section (`landing.marketingPage.faqBadge`). */
		faqBadge: string;
		/** Title for the FAQ section (`landing.marketingPage.faqTitle`). */
		faqTitle: string;
		/** Lead paragraph below the FAQ title (`landing.marketingPage.faqDescription`). */
		faqDescription: string;
		/** Heading for the final call-to-action banner (`landing.marketingPage.finalCtaTitle`). */
		finalCtaTitle: string;
		/** Supporting copy for the final call-to-action banner (`landing.finalCta.body`). */
		finalCtaBody: string;
	}
}

/**
 * Resolves every page-agnostic string {@link MarketingPageView} needs, so the three
 * controllers rendering it (`/features/:slug`, `/for/:slug`, `/use-cases/:slug`) share
 * one definition instead of repeating the same dozen `t()` calls each. The view itself
 * never reads i18n — it only ever receives plain, already-translated strings.
 */
export function buildMarketingPageChrome(t: TFunction): MarketingPageView.Chrome {
	return {
		startLabel: t("landing.hero.cta.out"),
		dashboardLabel: t("landing.hero.cta.in"),
		pricingLabel: t("landing.hero.cta.pricing"),
		screenshotAlt: t("landing.hero.screenshot.alt"),
		everythingBadge: t("landing.marketingPage.everythingBadge"),
		everythingTitle: t("landing.marketingPage.everythingTitle"),
		everythingDescription: t("landing.marketingPage.everythingDescription"),
		howItWorksBadge: t("landing.marketingPage.howItWorksBadge"),
		howItWorksTitle: t("landing.marketingPage.howItWorksTitle"),
		howItWorksDescription: t("landing.marketingPage.howItWorksDescription"),
		faqBadge: t("landing.marketingPage.faqBadge"),
		faqTitle: t("landing.marketingPage.faqTitle"),
		faqDescription: t("landing.marketingPage.faqDescription"),
		finalCtaTitle: t("landing.marketingPage.finalCtaTitle"),
		finalCtaBody: t("landing.finalCta.body"),
	};
}

/** Renders the generic marketing page sections, populated entirely from `handle.props`. */
export default function MarketingPageView(handle: Handle<MarketingPageView.Props>) {
	return () => {
		let {
			isSignedIn,
			startLabel,
			dashboardLabel,
			pricingLabel,
			screenshotAlt,
			badge,
			title,
			highlight,
			description,
			highlights,
			features,
			steps,
			faqs,
			trustIndicators,
			everythingBadge,
			everythingTitle,
			everythingDescription,
			howItWorksBadge,
			howItWorksTitle,
			howItWorksDescription,
			faqBadge,
			faqTitle,
			faqDescription,
			finalCtaTitle,
			finalCtaBody,
		} = handle.props;

		/** Split into two balanced accordion columns, the longer half first. */
		let faqSplitIndex = Math.ceil(faqs.length / 2);
		let firstFaqColumn = faqs.slice(0, faqSplitIndex);
		let secondFaqColumn = faqs.slice(faqSplitIndex);

		return (
			<>
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
									{badge}
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
									{title} <span mix={[fg("brand")]}>{highlight}</span>
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
									{description}
								</p>

								<div mix={[...ctaRow()]}>
									<AuthCta
										isSignedIn={isSignedIn}
										startLabel={startLabel}
										dashboardLabel={dashboardLabel}
										icon={<ArrowRightIcon size={20} strokeWidth={1.5} aria-hidden />}
									/>
									{/* Points at the homepage's pricing calculator: these pages carry
									no pricing section of their own to anchor to. */}
									<LinkButton
										href={`${routes.home.href()}#pricing`}
										color="neutral"
										variant="outline"
										size="lg"
									>
										{pricingLabel}
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
									{highlights.map((item) => (
										<span
											key={item}
											mix={[
												inlineFlex(),
												items("center"),
												gap("6px"),
												fontSize("sm"),
												fg("neutral.muted"),
											]}
										>
											<CheckIcon size={16} strokeWidth={2} aria-hidden mix={[fg("success")]} />
											{item}
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
									alt={screenshotAlt}
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

				{/* Only pages carrying their own figures get the strip — an empty band would
				read as a stray divider between the hero and the feature grid. */}
				{trustIndicators && (
					<MarketingTrustIndicators
						indicators={trustIndicators.map((indicator) => ({
							icon: <Icon name={indicator.icon} size={24} strokeWidth={1.5} aria-hidden />,
							value: indicator.value,
							label: indicator.label,
						}))}
					/>
				)}

				<section mix={[...sectionPadding()]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader
							badge={everythingBadge}
							title={everythingTitle}
							description={everythingDescription}
						/>

						<div mix={[grid(), gap(8), ...responsiveGrid()]}>
							{features.map((feature) => (
								<MarketingCard
									key={feature.title}
									icon={
										feature.icon && (
											<Icon name={feature.icon} size={24} strokeWidth={1.5} aria-hidden />
										)
									}
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
							badge={howItWorksBadge}
							title={howItWorksTitle}
							description={howItWorksDescription}
						/>

						<div mix={[grid(), gap(8), counterReset("marketing-step"), ...responsiveGrid()]}>
							{steps.map((step) => (
								<MarketingStep key={step.title} title={step.title} description={step.description} />
							))}
						</div>
					</div>
				</section>

				<section mix={[...sectionPadding()]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader badge={faqBadge} title={faqTitle} description={faqDescription} />

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
							{secondFaqColumn.length > 0 && <FaqAccordion items={secondFaqColumn} />}
						</div>
					</div>
				</section>

				<section
					mix={[
						pb(16),
						textAlign("center"),
						bg({
							image: linearGradient(
								"to right",
								"var(--ui-brand-bg-solid)",
								"var(--ui-brand-bg-solid-hover)",
							),
						}),
						fg("brand.onSolid"),
						media("(min-width: 640px)", pb(24)),
					]}
				>
					<div mix={[...marketingContainer()]}>
						<Heading
							level={2}
							// `fg` explicitly, unlike the paragraph beside it: `Heading` sets its
							// own `neutral.emphasis` color, which would otherwise win over the
							// band's inherited on-solid color and render the title near-black
							// against the brand background.
							mix={[
								m(0),
								fontSize("3xl"),
								weight(700),
								leading(1.15),
								tracking("tight"),
								fg("brand.onSolid"),
								media("(min-width: 640px)", fontSize("4xl")),
							]}
						>
							{finalCtaTitle}
						</Heading>
						{/* Slightly dimmed against the band so the heading still leads it. */}
						<p
							mix={[
								m(0),
								mbs(4),
								mi("auto"),
								maxIs("672px"),
								fontSize("lg"),
								leading(1.625),
								opacity(90),
							]}
						>
							{finalCtaBody}
						</p>

						<div mix={[...ctaRow()]}>
							{/* `neutral` on this brand-filled band: a brand-toned button on a
							brand fill reads only by its border. Neutral's solid background is
							the theme's inverted shade, so it stays high-contrast in both
							schemes. */}
							<AuthCta
								isSignedIn={isSignedIn}
								startLabel={startLabel}
								dashboardLabel={dashboardLabel}
								color="neutral"
								icon={<ArrowRightIcon size={20} strokeWidth={1.5} aria-hidden />}
							/>
						</div>
					</div>
				</section>
			</>
		);
	};
}
