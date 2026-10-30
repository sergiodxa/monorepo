/**
 * The SaaS demo landing: Keel, an invented usage-based billing product, set in a precise,
 * technical register: slate neutrals, one sea-green accent, hairline rails down the page,
 * numbered mono chapters, and product screens and code in every media slot.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";

import type { DemoLanding } from "~/resources/views/demos";

import DemoTheme from "~/resources/components/demo-theme";
import { SaasFooter } from "~/resources/views/demos/saas/footer";
import { SaasHeader } from "~/resources/views/demos/saas/header";
import {
	ChangelogSection,
	ClosingBand,
	CustomersStrip,
	FaqSection,
	FiguresStrip,
	HeroSection,
	MeteringChapter,
	PlatformChapter,
	PricingSection,
	SecurityChapter,
	TestimonialSection,
	WorkflowBand,
} from "~/resources/views/demos/saas/sections";

/** Keel's brand ramp: a sea green at hue 168, on the site's lightness steps. */
const BRAND = [
	"oklch(0.985 0.014 168)",
	"oklch(0.955 0.034 168)",
	"oklch(0.9 0.07 168)",
	"oklch(0.82 0.115 168)",
	"oklch(0.73 0.14 168)",
	"oklch(0.62 0.135 168)",
	"oklch(0.52 0.115 168)",
	"oklch(0.43 0.095 168)",
	"oklch(0.33 0.074 168)",
	"oklch(0.245 0.055 168)",
	"oklch(0.165 0.038 168)",
] as const;

/** Slate neutrals with barely any chroma, so the page reads as ink on paper and the green is the only colour. */
const NEUTRAL = [
	"oklch(0.988 0.0015 250)",
	"oklch(0.96 0.003 250)",
	"oklch(0.91 0.005 250)",
	"oklch(0.82 0.008 250)",
	"oklch(0.71 0.011 250)",
	"oklch(0.6 0.013 250)",
	"oklch(0.5 0.014 250)",
	"oklch(0.41 0.014 250)",
	"oklch(0.31 0.012 250)",
	"oklch(0.22 0.01 250)",
	"oklch(0.15 0.008 250)",
] as const;

/** A grotesk stack: the reader's system grotesk where neither named face is installed. */
const SANS = "Geist, Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

/** A mono stack for eyebrows, figures, code and product identifiers. */
const MONO = "'Geist Mono', 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

/**
 * Square 6px CTAs, 8px surfaces, hairlines where other demos draw shadows, a tightly
 * tracked grotesk display and mono uppercase eyebrows. Shadows are rings of the hairline,
 * so the same line separates surfaces in light and in dark.
 */
const TOKENS = {
	"--ui-font-sans": SANS,
	"--ui-font-display": SANS,
	"--ui-font-mono": MONO,
	"--ui-marketing-cta-radius": "6px",
	"--ui-marketing-cta-weight": "500",
	"--ui-marketing-display-weight": "600",
	"--ui-marketing-display-tracking": "-0.045em",
	"--ui-marketing-display-max": "4.5rem",
	"--ui-marketing-chapter-tracking": "-0.035em",
	"--ui-marketing-radius-surface": "8px",
	"--ui-marketing-card-radius-outer": "8px",
	"--ui-marketing-radius-frame": "8px",
	"--ui-marketing-band-radius": "12px",
	"--ui-marketing-plan-radius": "8px",
	"--ui-marketing-hairline": "color-mix(in oklch, var(--ui-neutral-fg-emphasis) 11%, transparent)",
	"--ui-shadow-surface": "0 0 0 1px var(--ui-marketing-hairline)",
	"--ui-shadow-stage": "0 0 0 1px var(--ui-marketing-hairline)",
	"--ui-shadow-control": "0 0 0 1px var(--ui-marketing-hairline)",
	"--ui-shadow-float": "0 0 0 1px var(--ui-marketing-hairline), 0 16px 32px -16px rgb(0 0 0 / 0.3)",
	"--ui-marketing-eyebrow-font": "var(--ui-font-mono)",
	"--ui-marketing-eyebrow-weight": "500",
	"--ui-marketing-eyebrow-transform": "uppercase",
	"--ui-marketing-eyebrow-tracking": "0.08em",
	"--ui-marketing-eyebrow-color":
		"color-mix(in oklch, var(--ui-brand-fg) 80%, var(--ui-brand-fg-emphasis))",
} as const;

/**
 * The Keel page. The chapters between the hero and the workflow band, and between the
 * workflow band and the customers, stack as one ruled column; every in-page target clears
 * the sticky bar when a link scrolls to it.
 */
export default {
	title: "Keel — Usage-based billing for API companies",
	description:
		"Keel meters every event your product emits, prices it on any plan and sends the invoice on the first of the month.",
	render: () => (
		<DemoTheme brand={BRAND} neutral={NEUTRAL} tokens={TOKENS}>
			<SaasHeader />
			<main id="top" mix={[when("& [id]", raw({ scrollMarginBlockStart: "4.5rem" }))]}>
				<HeroSection />
				<CustomersStrip />
				<MeteringChapter />
				<FiguresStrip />
				<WorkflowBand />
				<PlatformChapter />
				<SecurityChapter />
				<ChangelogSection />
				<TestimonialSection />
				<PricingSection />
				<FaqSection />
				<ClosingBand />
			</main>
			<SaasFooter />
		</DemoTheme>
	),
} satisfies DemoLanding;
