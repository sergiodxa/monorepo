/**
 * Generic marketing page view shared by `/features/:slug`, `/for/:slug`, and
 * `/use-cases/:slug`. Renders a hero with highlight chips, a feature grid, a
 * numbered "how it works" list, an FAQ accordion (native `<details>`, no client
 * JS), and a final call to action. It exists so those three route families reuse
 * one view instead of near-duplicate ones, driven entirely by
 * `resources/content/marketing.ts` data plus a handful of translated section
 * titles the calling controller threads through as plain props (the same
 * convention `AppShell` uses for its own `heading`/`breadcrumbs` props).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { CheckIcon } from "@pkg/lucide-remix";
import { bg, border, fg, linearGradient } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { raw } from "@pkg/u/general";
import {
	flex,
	flexCol,
	flexRow,
	flexWrap,
	gap,
	grid,
	inlineFlex,
	items,
	justify,
} from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { maxIs, mbe, mbs, mi, p, pb, pi } from "@pkg/u/size";
import { fontSize, leading, textAlign, tracking, weight } from "@pkg/u/typography";

import type { MarketingContent } from "~/resources/content/marketing";

import AuthCta from "~/resources/components/marketing/auth-cta";
import MarketingCard from "~/resources/components/marketing/card";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import SectionHeader from "~/resources/components/marketing/section-header";
import MarketingStep from "~/resources/components/marketing/step";

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
	export interface Props extends MarketingContent.Page {
		isSignedIn: boolean;
		/** Label for the signed-out CTA button (`landing.hero.cta.out`). */
		startLabel: string;
		/** Label for the signed-in CTA link (`landing.hero.cta.in`). */
		dashboardLabel: string;
		/** Title for the feature-grid section (`landing.marketingPage.everythingTitle`). */
		everythingTitle: string;
		/** Title for the numbered "how it works" section (`landing.marketingPage.howItWorksTitle`). */
		howItWorksTitle: string;
		/** Title for the FAQ section (`landing.marketingPage.faqTitle`). */
		faqTitle: string;
		/** Heading for the final call-to-action banner (`landing.marketingPage.finalCtaTitle`). */
		finalCtaTitle: string;
		/** Supporting copy for the final call-to-action banner (`landing.finalCta.body`). */
		finalCtaBody: string;
	}
}

/** Renders the generic marketing page sections, populated entirely from `handle.props`. */
export default function MarketingPageView(handle: Handle<MarketingPageView.Props>) {
	return () => {
		let {
			isSignedIn,
			startLabel,
			dashboardLabel,
			badge,
			title,
			highlight,
			description,
			highlights,
			features,
			steps,
			faqs,
			everythingTitle,
			howItWorksTitle,
			faqTitle,
			finalCtaTitle,
			finalCtaBody,
		} = handle.props;

		return (
			<>
				<section
					mix={[
						...sectionPadding(),
						textAlign("center"),
						bg({
							image: linearGradient(
								"to bottom",
								"var(--ui-primary-bg-tint)",
								"var(--ui-neutral-bg-tint)",
							),
						}),
					]}
				>
					<div mix={[...marketingContainer()]}>
						<span
							mix={[
								inlineFlex(),
								items("center"),
								p("2px", "10px"),
								rounded("999px"),
								fontSize("0.75rem"),
								weight(600),
								border({ color: "primary.border", width: 1 }),
								bg("primary.tint"),
								fg("primary.fg"),
								mbe(4),
							]}
						>
							{badge}
						</span>
						<h1
							mix={[
								fontSize("2.25rem"),
								weight(700),
								leading(1),
								tracking("tight"),
								mbs(0),
								mi("auto"),
								mbe(4),
								maxIs("760px"),
								fg("neutral.emphasis"),
								media("(min-width: 640px)", fontSize("3rem")),
								media("(min-width: 1024px)", fontSize("3.75rem")),
							]}
						>
							{title} <span mix={[fg("primary.fg")]}>{highlight}</span>
						</h1>
						<p
							mix={[
								fontSize("1.125rem"),
								fg("neutral.fg"),
								mbs(0),
								mi("auto"),
								mbe(6),
								maxIs("576px"),
								leading(1.625),
							]}
						>
							{description}
						</p>

						<div mix={[flex(), flexWrap(), justify("center"), gap(2, 6), mbs(8)]}>
							{highlights.map((item) => (
								<span
									key={item}
									mix={[
										inlineFlex(),
										items("center"),
										gap("6px"),
										fontSize("0.875rem"),
										fg("neutral.muted"),
									]}
								>
									<CheckIcon size={16} />
									{item}
								</span>
							))}
						</div>

						<div mix={[...ctaRow()]}>
							<AuthCta
								isSignedIn={isSignedIn}
								startLabel={startLabel}
								dashboardLabel={dashboardLabel}
							/>
						</div>
					</div>
				</section>

				<section mix={[...sectionPadding()]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader title={everythingTitle} />

						<div
							mix={[
								grid(),
								gap(8),
								raw({ gridTemplateColumns: "1fr" }),
								media("(min-width: 768px)", raw({ gridTemplateColumns: "repeat(2, 1fr)" })),
								media("(min-width: 1024px)", raw({ gridTemplateColumns: "repeat(3, 1fr)" })),
							]}
						>
							{features.map((feature) => (
								<MarketingCard
									key={feature.title}
									title={feature.title}
									description={feature.description}
								/>
							))}
						</div>
					</div>
				</section>

				<section mix={[...sectionPadding(), bg("neutral.tint")]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader title={howItWorksTitle} />

						<div
							mix={[
								grid(),
								gap(6),
								raw({ gridTemplateColumns: "1fr", counterReset: "marketing-step" }),
								media("(min-width: 768px)", raw({ gridTemplateColumns: "repeat(2, 1fr)" })),
								media("(min-width: 1024px)", raw({ gridTemplateColumns: "repeat(3, 1fr)" })),
							]}
						>
							{steps.map((step) => (
								<MarketingStep key={step.title} title={step.title} description={step.description} />
							))}
						</div>
					</div>
				</section>

				<section mix={[...sectionPadding()]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader title={faqTitle} />

						<FaqAccordion items={faqs.map((faq) => ({ ...faq }))} />
					</div>
				</section>

				<section
					mix={[
						pb(14),
						textAlign("center"),
						bg({
							image: linearGradient(
								"to right",
								"var(--ui-primary-bg-solid)",
								"var(--ui-primary-bg-solid-hover)",
							),
						}),
						fg("primary.onSolid"),
					]}
				>
					<h2>{finalCtaTitle}</h2>
					<p>{finalCtaBody}</p>

					<div mix={[...ctaRow()]}>
						<AuthCta
							isSignedIn={isSignedIn}
							startLabel={startLabel}
							dashboardLabel={dashboardLabel}
						/>
					</div>
				</section>
			</>
		);
	};
}
