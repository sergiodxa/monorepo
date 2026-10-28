/**
 * Generic marketing page view shared by `/features/:slug`, `/for/:slug`, and
 * `/use-cases/:slug`: a split hero, trust-indicator strip, feature grid, numbered
 * "how it works" row, two-column FAQ accordion, and a final call to action, driven
 * by content records and assembled from `@sdxc/ui` marketing primitives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { ArrowRightIcon, Icon } from "@sdxc/icons";
import { bg, border, fg, linearGradient } from "@sdxc/u/color";
import { rounded, shadow } from "@sdxc/u/effects";
import { block } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, is } from "@sdxc/u/size";
import { LinkButton } from "@sdxc/ui";
import {
	AccentText,
	CheckList,
	CheckRow,
	ClosingCta,
	FaqBand,
	FeatureBand,
	LandingHero,
	ProductFrame,
	StepList,
} from "@sdxc/ui/patterns";

import type { MarketingContent } from "~/resources/content/marketing";

import { FREE_TRIAL_DAYS } from "~/config/pricing";
import AuthCta from "~/resources/components/marketing/auth-cta";
import MarketingCard from "~/resources/components/marketing/card";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import MarketingTrustIndicators from "~/resources/components/marketing/trust-indicators";
import routes from "~/routes/web";

/** Light-mode hero screenshot, also the `<img>` fallback for engines without `<picture>` support. */
export const SCREENSHOT_LIGHT = "/screenshot-light.webp";

/** Dark-mode hero screenshot, selected by the `<source>` media condition. */
export const SCREENSHOT_DARK = "/screenshot-dark.webp";

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
		/**
		 * Label for the free-trial CTA, linking to `/try` (`landing.hero.cta.try`). The primary
		 * action for a visitor with no account: every page sells a seven-day free watch needing
		 * neither account nor card, reachable before this label only from the homepage and nav.
		 */
		tryLabel: string;
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
 * Resolves every page-agnostic string {@link MarketingPageView} needs, letting the three
 * controllers rendering it (`/features/:slug`, `/for/:slug`, `/use-cases/:slug`) share one
 * set of `t()` calls; the view itself renders only plain, already-translated strings.
 */
export function buildMarketingPageChrome(t: Translate): MarketingPageView.Chrome {
	return {
		startLabel: t("landing.hero.cta.out"),
		dashboardLabel: t("landing.hero.cta.in"),
		pricingLabel: t("landing.hero.cta.pricing"),
		/**
		 * The offer length comes from the pricing module here, so every locale's label tracks a
		 * change to it automatically — a literal "7 days" once drifted out of sync in all six
		 * locales before a translator caught the missing source.
		 */
		tryLabel: t("landing.hero.cta.try", { days: FREE_TRIAL_DAYS }),
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

/**
 * Renders the generic marketing page sections from `@sdxc/ui` patterns. The
 * closing band keeps the brand gradient via `mix` so the final CTA still reads
 * as the product's own close rather than a neutral inverse strip.
 */
export default function MarketingPageView(handle: Handle<MarketingPageView.Props>) {
	return () => {
		let {
			isSignedIn,
			startLabel,
			dashboardLabel,
			pricingLabel,
			tryLabel,
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
				<LandingHero
					tone="tinted"
					mediaPlacement="end"
					eyebrow={badge}
					eyebrowVariant="pill"
					title={
						<>
							{title} <AccentText>{highlight}</AccentText>
						</>
					}
					description={description}
					actions={
						<>
							{isSignedIn ? (
								<AuthCta
									isSignedIn
									startLabel={startLabel}
									dashboardLabel={dashboardLabel}
									icon={<ArrowRightIcon size={20} strokeWidth={1.5} />}
								/>
							) : (
								<LinkButton href={routes.trial.check.index.href()} color="brand" size="lg">
									{tryLabel}
									<ArrowRightIcon size={20} strokeWidth={1.5} />
								</LinkButton>
							)}
							<LinkButton
								href={`${routes.home.href()}#pricing`}
								prefetch="intent"
								color="neutral"
								variant="outline"
								size="lg"
							>
								{pricingLabel}
							</LinkButton>
						</>
					}
					below={
						<CheckList orientation="horizontal">
							{highlights.map((item) => (
								<CheckRow key={item}>{item}</CheckRow>
							))}
						</CheckList>
					}
					media={
						<ProductFrame lights>
							<picture
								mix={[
									block(),
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
									width={3216}
									height={2080}
									mix={[block(), is("full"), bs("auto")]}
								/>
							</picture>
						</ProductFrame>
					}
				/>

				{trustIndicators && (
					<MarketingTrustIndicators
						indicators={trustIndicators.map((indicator) => ({
							icon: <Icon name={indicator.icon} size={24} strokeWidth={1.5} />,
							value: indicator.value,
							valueLabel: indicator.valueLabel,
							label: indicator.label,
						}))}
					/>
				)}

				<FeatureBand
					layout="grid"
					columns={3}
					eyebrow={everythingBadge}
					title={everythingTitle}
					description={everythingDescription}
				>
					{features.map((feature) => (
						<MarketingCard
							key={feature.title}
							icon={feature.icon && <Icon name={feature.icon} size={24} strokeWidth={1.5} />}
							title={feature.title}
							description={feature.description}
						/>
					))}
				</FeatureBand>

				<FeatureBand
					layout="steps"
					tone="tinted"
					eyebrow={howItWorksBadge}
					title={howItWorksTitle}
					description={howItWorksDescription}
				>
					{steps.map((step) => (
						<StepList.Item key={step.title} title={step.title}>
							{step.description}
						</StepList.Item>
					))}
				</FeatureBand>

				<FaqBand columns={2} eyebrow={faqBadge} title={faqTitle} description={faqDescription}>
					<FaqAccordion items={firstFaqColumn} />
					{secondFaqColumn.length > 0 ? <FaqAccordion items={secondFaqColumn} /> : null}
				</FaqBand>

				<ClosingCta
					tone="plain"
					title={finalCtaTitle}
					description={finalCtaBody}
					mix={[
						bg({
							image: linearGradient(
								"to right",
								"var(--ui-brand-bg-solid)",
								"var(--ui-brand-bg-solid-hover)",
							),
						}),
						fg("brand.onSolid"),
					]}
					parts={{
						title: [fg("brand.onSolid")],
						description: [fg("brand.onSolid")],
					}}
					actions={
						<AuthCta
							isSignedIn={isSignedIn}
							startLabel={startLabel}
							dashboardLabel={dashboardLabel}
							color="neutral"
							icon={<ArrowRightIcon size={20} strokeWidth={1.5} />}
						/>
					}
				/>
			</>
		);
	};
}
