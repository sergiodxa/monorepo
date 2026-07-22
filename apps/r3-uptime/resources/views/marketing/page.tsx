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
import { css } from "remix/ui";

import type { MarketingContent } from "~/resources/content/marketing";

import AuthCta from "~/resources/components/marketing/auth-cta";
import MarketingCard from "~/resources/components/marketing/card";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import SectionHeader from "~/resources/components/marketing/section-header";
import MarketingStep from "~/resources/components/marketing/step";

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
						css({
							padding: "64px 0",
							textAlign: "center",
							background:
								"linear-gradient(to bottom, var(--ui-primary-bg-tint), var(--ui-neutral-bg-tint))",
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								padding: "0 16px",
								"@media (min-width: 640px)": { padding: "0 24px" },
								"@media (min-width: 1024px)": { padding: "0 32px" },
							}),
						]}
					>
						<span
							mix={[
								css({
									display: "inline-flex",
									alignItems: "center",
									padding: "2px 10px",
									borderRadius: 999,
									fontSize: "0.75rem",
									fontWeight: 600,
									border: "1px solid var(--ui-primary-border)",
									background: "var(--ui-primary-bg-tint)",
									color: "var(--ui-primary-fg)",
									marginBottom: 16,
								}),
							]}
						>
							{badge}
						</span>
						<h1
							mix={[
								css({
									fontSize: "2.25rem",
									fontWeight: 700,
									lineHeight: 1,
									letterSpacing: "-0.025em",
									margin: "0 auto 16px",
									maxWidth: 760,
									color: "var(--ui-neutral-fg-emphasis)",
									"@media (min-width: 640px)": { fontSize: "3rem" },
									"@media (min-width: 1024px)": { fontSize: "3.75rem" },
								}),
							]}
						>
							{title} <span mix={[css({ color: "var(--ui-primary-fg)" })]}>{highlight}</span>
						</h1>
						<p
							mix={[
								css({
									fontSize: "1.125rem",
									color: "var(--ui-neutral-fg)",
									margin: "0 auto 24px",
									maxWidth: 576,
									lineHeight: 1.625,
								}),
							]}
						>
							{description}
						</p>

						<div
							mix={[
								css({
									display: "flex",
									flexWrap: "wrap",
									justifyContent: "center",
									gap: "8px 24px",
									marginTop: 32,
								}),
							]}
						>
							{highlights.map((item) => (
								<span
									key={item}
									mix={[
										css({
											display: "inline-flex",
											alignItems: "center",
											gap: 6,
											fontSize: "0.875rem",
											color: "var(--ui-neutral-fg-muted)",
										}),
									]}
								>
									<CheckIcon size={16} />
									{item}
								</span>
							))}
						</div>

						<div
							mix={[
								css({
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									gap: 16,
									marginTop: 32,
									"@media (min-width: 640px)": { flexDirection: "row", justifyContent: "center" },
								}),
							]}
						>
							<AuthCta
								isSignedIn={isSignedIn}
								startLabel={startLabel}
								dashboardLabel={dashboardLabel}
							/>
						</div>
					</div>
				</section>

				<section
					mix={[
						css({
							padding: "64px 0",
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								padding: "0 16px",
								"@media (min-width: 640px)": { padding: "0 24px" },
								"@media (min-width: 1024px)": { padding: "0 32px" },
							}),
						]}
					>
						<SectionHeader title={everythingTitle} />

						<div
							mix={[
								css({
									display: "grid",
									gap: 32,
									gridTemplateColumns: "1fr",
									"@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, 1fr)" },
									"@media (min-width: 1024px)": { gridTemplateColumns: "repeat(3, 1fr)" },
								}),
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

				<section
					mix={[
						css({
							padding: "64px 0",
							background: "var(--ui-neutral-bg-tint)",
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								padding: "0 16px",
								"@media (min-width: 640px)": { padding: "0 24px" },
								"@media (min-width: 1024px)": { padding: "0 32px" },
							}),
						]}
					>
						<SectionHeader title={howItWorksTitle} />

						<div
							mix={[
								css({
									display: "grid",
									gap: 24,
									gridTemplateColumns: "1fr",
									counterReset: "marketing-step",
									"@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, 1fr)" },
									"@media (min-width: 1024px)": { gridTemplateColumns: "repeat(3, 1fr)" },
								}),
							]}
						>
							{steps.map((step) => (
								<MarketingStep key={step.title} title={step.title} description={step.description} />
							))}
						</div>
					</div>
				</section>

				<section
					mix={[
						css({
							padding: "64px 0",
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								padding: "0 16px",
								"@media (min-width: 640px)": { padding: "0 24px" },
								"@media (min-width: 1024px)": { padding: "0 32px" },
							}),
						]}
					>
						<SectionHeader title={faqTitle} />

						<FaqAccordion items={faqs.map((faq) => ({ ...faq }))} />
					</div>
				</section>

				<section
					mix={[
						css({
							padding: "56px 0",
							textAlign: "center",
							background:
								"linear-gradient(to right, var(--ui-primary-bg-solid), var(--ui-primary-bg-solid-hover))",
							color: "var(--ui-primary-fg-on-solid)",
						}),
					]}
				>
					<h2>{finalCtaTitle}</h2>
					<p>{finalCtaBody}</p>

					<div
						mix={[
							css({
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: 16,
								marginTop: 32,
								"@media (min-width: 640px)": { flexDirection: "row", justifyContent: "center" },
							}),
						]}
					>
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
