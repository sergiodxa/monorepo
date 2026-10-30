/**
 * The SaaS demo landing: Keel, an invented usage-based billing product, drawn end to end
 * with `@sdxc/ui` marketing patterns under its own sea-green palette. It shows what the
 * components reach for a B2B product page, with staged product UI in every media slot.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DemoLanding } from "~/resources/views/demos";

import DemoTheme from "~/resources/components/demo-theme";
import { SaasFooter } from "~/resources/views/demos/saas/footer";
import { SaasHeader } from "~/resources/views/demos/saas/header";
import {
	ClosingBand,
	FaqSection,
	HeroSection,
	MeteringBand,
	PlatformBand,
	PricingSection,
	ProofSection,
	SecurityBand,
	TestimonialSection,
	WorkflowBand,
} from "~/resources/views/demos/saas/sections";

/** Keel's brand ramp: a sea green at hue 168, on the site's lightness steps. */
const BRAND = [
	"oklch(0.985 0.012 168)",
	"oklch(0.955 0.03 168)",
	"oklch(0.9 0.06 168)",
	"oklch(0.81 0.1 168)",
	"oklch(0.71 0.13 168)",
	"oklch(0.61 0.135 168)",
	"oklch(0.52 0.12 168)",
	"oklch(0.43 0.1 168)",
	"oklch(0.33 0.078 168)",
	"oklch(0.245 0.058 168)",
	"oklch(0.165 0.04 168)",
] as const;

/** Cool slate neutrals, tinted toward blue so the green brand reads crisp against them. */
const NEUTRAL = [
	"oklch(0.985 0.002 245)",
	"oklch(0.955 0.005 245)",
	"oklch(0.9 0.008 245)",
	"oklch(0.81 0.012 245)",
	"oklch(0.71 0.016 245)",
	"oklch(0.61 0.019 245)",
	"oklch(0.52 0.021 245)",
	"oklch(0.43 0.021 245)",
	"oklch(0.33 0.019 245)",
	"oklch(0.245 0.016 245)",
	"oklch(0.165 0.013 245)",
] as const;

/** Pill CTAs, a semibold display face a step larger than the default, and green eyebrows. */
const TOKENS = {
	"--ui-marketing-cta-radius": "9999px",
	"--ui-marketing-display-max": "4.75rem",
	"--ui-marketing-display-weight": "600",
	"--ui-marketing-eyebrow-color":
		"color-mix(in oklch, var(--ui-brand-fg) 80%, var(--ui-brand-fg-emphasis))",
} as const;

/** The Keel page, from its sticky bar to its footer. */
export default {
	title: "Keel — Usage-based billing for API companies",
	description:
		"Keel meters every event your product emits, prices it on any plan and sends the invoice on the first of the month.",
	render: () => (
		<DemoTheme brand={BRAND} neutral={NEUTRAL} tokens={TOKENS}>
			<SaasHeader />
			<main id="top">
				<HeroSection />
				<ProofSection />
				<MeteringBand />
				<WorkflowBand />
				<PlatformBand />
				<SecurityBand />
				<TestimonialSection />
				<PricingSection />
				<FaqSection />
				<ClosingBand />
			</main>
			<SaasFooter />
		</DemoTheme>
	),
} satisfies DemoLanding;
