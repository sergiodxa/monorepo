/**
 * The `/demo/app` landing: Rooftree, an invented household app for phones and desktops,
 * built only from `@sdxc/ui` landing patterns on its own grape-and-sunshine palette, rounded
 * faces, pill calls and soft shadows, to show a downloadable-app page reaching store polish.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { HeadingScope } from "@sdxc/ui";

import type { DemoLanding } from "~/resources/views/demos";

import DemoTheme from "~/resources/components/demo-theme";
import { Download, Pricing, Questions, Stories } from "~/resources/views/demos/app/closing";
import { Details, Platforms, Privacy, Tour } from "~/resources/views/demos/app/features";
import { Hero } from "~/resources/views/demos/app/hero";
import { SiteFooter, SiteHeader } from "~/resources/views/demos/app/site-chrome";

/** Rooftree's grape: a violet that stays saturated from the tint to the ink. */
const GRAPE = [
	"oklch(0.977 0.014 300)",
	"oklch(0.946 0.034 300)",
	"oklch(0.894 0.066 298)",
	"oklch(0.811 0.11 296)",
	"oklch(0.702 0.165 294)",
	"oklch(0.606 0.205 292)",
	"oklch(0.53 0.215 290)",
	"oklch(0.455 0.195 290)",
	"oklch(0.38 0.155 290)",
	"oklch(0.3 0.11 290)",
	"oklch(0.205 0.072 290)",
] as const;

/** Greys with a trace of the grape, so the lavender-white page and the ink agree. */
const LAVENDER_GREY = [
	"oklch(0.985 0.006 300)",
	"oklch(0.958 0.009 300)",
	"oklch(0.905 0.012 298)",
	"oklch(0.815 0.014 296)",
	"oklch(0.705 0.016 294)",
	"oklch(0.6 0.017 292)",
	"oklch(0.5 0.017 290)",
	"oklch(0.41 0.016 290)",
	"oklch(0.32 0.014 290)",
	"oklch(0.235 0.012 290)",
	"oklch(0.16 0.01 290)",
] as const;

/** The rounded face Rooftree's headings and labels are set in. */
const ROUNDED =
	"ui-rounded, 'SF Pro Rounded', 'Nunito', 'Varela Round', ui-sans-serif, system-ui, sans-serif";

/** Soft, layered lift: a contact shadow, a near shadow and a wide grape-tinted bloom. */
const SOFT_SHADOW =
	"0 1px 2px oklch(0.3 0.1 290 / 0.06), 0 6px 16px -4px oklch(0.3 0.1 290 / 0.08), 0 24px 48px -16px oklch(0.3 0.1 290 / 0.14)";

/**
 * A friendly consumer register: rounded heavy display, pill CTAs everywhere (store
 * badges included), 24px cards and 32px inset bands, soft layered shadows, lavender
 * tinted bands and deep grape where a band or plan inverts.
 */
const TOKENS = {
	"--ui-font-sans": "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
	"--ui-font-display": ROUNDED,
	"--ui-marketing-display-weight": "800",
	"--ui-marketing-display-tracking": "-0.035em",
	"--ui-marketing-display-max": "4.75rem",
	"--ui-marketing-chapter-tracking": "-0.03em",
	"--ui-marketing-cta-radius": "9999px",
	"--ui-marketing-cta-height": "3rem",
	"--ui-marketing-cta-weight": "650",
	"--ui-button-radius": "9999px",
	"--ui-marketing-eyebrow-font": ROUNDED,
	"--ui-marketing-eyebrow-transform": "none",
	"--ui-marketing-eyebrow-tracking": "0",
	"--ui-marketing-eyebrow-weight": "700",
	"--ui-marketing-eyebrow-color": "var(--ui-brand-fg)",
	"--ui-marketing-radius-surface": "1.5rem",
	"--ui-marketing-card-radius-outer": "1.5rem",
	"--ui-marketing-card-radius-inner": "1.5rem",
	"--ui-marketing-radius-frame": "1.75rem",
	"--ui-marketing-band-radius": "2rem",
	"--ui-shadow-surface": SOFT_SHADOW,
	"--ui-shadow-stage": SOFT_SHADOW,
	"--ui-marketing-band-tint": "var(--ui-color-brand-100)",
	"--ui-neutral-bg-solid": "var(--ui-color-brand-950)",
	"--ui-marketing-band-glow": "none",
} as const;

/** What `/demo/app` serves: Rooftree's head metadata and its whole page. */
export default {
	title: "Rooftree — the shared list for everyone under your roof",
	description:
		"Rooftree keeps a household's groceries, chores, calendar and meals on one encrypted list that syncs across iPhone, Android, Mac and Windows.",
	render: () => (
		<DemoTheme brand={GRAPE} neutral={LAVENDER_GREY} tokens={TOKENS}>
			<SiteHeader />
			<main mix={[when("& [id]", raw({ scrollMarginBlockStart: "5.5rem" }))]}>
				<HeadingScope>
					<Hero />
					<Tour />
					<Stories />
					<Details />
					<Privacy />
					<Platforms />
					<Pricing />
					<Questions />
					<Download />
				</HeadingScope>
			</main>
			<SiteFooter />
		</DemoTheme>
	),
} satisfies DemoLanding;
