/**
 * Generic marketing page view shared by `/features/:slug`, `/for/:slug`, and
 * `/use-cases/:slug`. Renders a hero with highlight chips, a feature grid, a
 * numbered "how it works" list, an FAQ accordion (native `<details>`, no client
 * JS), and a final call to action. It exists so those three route families reuse
 * one view instead of near-duplicate ones, driven entirely by
 * `resources/content/marketing.ts` data.
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
	/** Adds `isSignedIn` (drives the CTA's copy/target) on top of the raw marketing-page content shape. */
	export interface Props extends MarketingContent.Page {
		isSignedIn: boolean;
	}
}

/** Primary (brand) scale shades used on this page, hue 142. */
const primary = {
	50: "oklch(0.98 0.02 142)",
	200: "oklch(0.92 0.08 142)",
	400: "oklch(0.78 0.16 142)",
	600: "oklch(0.6 0.16 142)",
	700: "oklch(0.5 0.14 142)",
	800: "oklch(0.42 0.12 142)",
	950: "oklch(0.24 0.06 142)",
} as const;

/** Neutral scale shades used on this page, hue 145. */
const neutral = {
	50: "oklch(0.98 0.005 145)",
	400: "oklch(0.73 0.01 145)",
	500: "oklch(0.62 0.01 145)",
	600: "oklch(0.52 0.01 145)",
	900: "oklch(0.24 0.005 145)",
	950: "oklch(0.16 0.004 145)",
} as const;

/** Renders the generic marketing page sections, populated entirely from `handle.props`. */
export default function MarketingPageView(handle: Handle<MarketingPageView.Props>) {
	return () => {
		let { isSignedIn, badge, title, highlight, description, highlights, features, steps, faqs } =
			handle.props;

		return (
			<>
				<section
					mix={[
						css({
							padding: "64px 0",
							textAlign: "center",
							background: `linear-gradient(to bottom, ${primary[50]}, #ffffff)`,
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
							"@media (prefers-color-scheme: dark)": {
								background: `linear-gradient(to bottom, oklch(0.24 0.06 142 / 0.2), ${neutral[950]})`,
							},
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
									border: `1px solid ${primary[200]}`,
									background: primary[50],
									color: primary[600],
									marginBottom: 16,
									"@media (prefers-color-scheme: dark)": {
										borderColor: primary[800],
										background: primary[950],
										color: primary[400],
									},
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
									color: neutral[900],
									"@media (min-width: 640px)": { fontSize: "3rem" },
									"@media (min-width: 1024px)": { fontSize: "3.75rem" },
									"@media (prefers-color-scheme: dark)": { color: neutral[50] },
								}),
							]}
						>
							{title}{" "}
							<span
								mix={[
									css({
										color: primary[600],
										"@media (prefers-color-scheme: dark)": { color: primary[400] },
									}),
								]}
							>
								{highlight}
							</span>
						</h1>
						<p
							mix={[
								css({
									fontSize: "1.125rem",
									color: neutral[600],
									margin: "0 auto 24px",
									maxWidth: 576,
									lineHeight: 1.625,
									"@media (prefers-color-scheme: dark)": { color: neutral[400] },
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
											color: neutral[500],
											"@media (prefers-color-scheme: dark)": { color: neutral[400] },
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
							<AuthCta isSignedIn={isSignedIn} />
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
						<SectionHeader title="Everything you need" />

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
							background: neutral[50],
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
							"@media (prefers-color-scheme: dark)": { background: "oklch(0.24 0.005 145 / 0.5)" },
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
						<SectionHeader title="How it works" />

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
						<SectionHeader title="Frequently asked questions" />

						<FaqAccordion items={faqs.map((faq) => ({ ...faq }))} />
					</div>
				</section>

				<section
					mix={[
						css({
							padding: "56px 0",
							textAlign: "center",
							background: `linear-gradient(to right, ${primary[600]}, ${primary[700]})`,
							color: "#ffffff",
						}),
					]}
				>
					<h2>Start monitoring your services</h2>
					<p>Create your first monitor in under 2 minutes. No credit card required to start.</p>

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
						<AuthCta isSignedIn={isSignedIn} />
					</div>
				</section>
			</>
		);
	};
}
