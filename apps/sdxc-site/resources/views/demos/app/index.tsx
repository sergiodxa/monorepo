/**
 * The `/demo/app` landing: Rooftree, an invented household app for phones and desktops,
 * built only from `@sdxc/ui` landing patterns on its own ember palette, warm greys and
 * rounded faces, to show a downloadable-app page reaching sold-template polish.
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
import { Hero, Proof } from "~/resources/views/demos/app/hero";
import { SiteFooter, SiteHeader } from "~/resources/views/demos/app/site-chrome";

/** Rooftree's ember: a terracotta hue that warms toward the light end of the ramp. */
const EMBER = [
	"oklch(0.985 0.012 50)",
	"oklch(0.955 0.03 46)",
	"oklch(0.9 0.062 43)",
	"oklch(0.81 0.105 41)",
	"oklch(0.71 0.15 39)",
	"oklch(0.61 0.17 37)",
	"oklch(0.52 0.16 36)",
	"oklch(0.43 0.135 35)",
	"oklch(0.33 0.1 35)",
	"oklch(0.245 0.07 35)",
	"oklch(0.165 0.042 35)",
] as const;

/** Warm greys with a trace of the ember's hue, so the cream page and the ink agree. */
const HEARTH_GREY = [
	"oklch(0.985 0.005 75)",
	"oklch(0.955 0.007 70)",
	"oklch(0.9 0.009 68)",
	"oklch(0.81 0.01 66)",
	"oklch(0.71 0.011 64)",
	"oklch(0.61 0.011 62)",
	"oklch(0.52 0.011 60)",
	"oklch(0.43 0.01 58)",
	"oklch(0.33 0.009 56)",
	"oklch(0.245 0.008 54)",
	"oklch(0.165 0.006 52)",
] as const;

/** Rounded system faces for an app's friendliness, pill CTAs and a heavier display. */
const TOKENS = {
	"--ui-font-sans": "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
	"--ui-font-display": "ui-rounded, 'SF Pro Rounded', ui-sans-serif, system-ui, sans-serif",
	"--ui-marketing-cta-radius": "9999px",
	"--ui-marketing-eyebrow-color": "var(--ui-brand-fg)",
	"--ui-marketing-display-max": "4.5rem",
} as const;

/** What `/demo/app` serves: Rooftree's head metadata and its whole page. */
export default {
	title: "Rooftree — the shared list for everyone under your roof",
	description:
		"Rooftree keeps a household's groceries, chores, calendar and meals on one encrypted list that syncs across iPhone, Android, Mac and Windows.",
	render: () => (
		<DemoTheme brand={EMBER} neutral={HEARTH_GREY} tokens={TOKENS}>
			<SiteHeader />
			<main mix={[when("& [id]", raw({ scrollMarginBlockStart: "4.5rem" }))]}>
				<HeadingScope>
					<Hero />
					<Proof />
					<Tour />
					<Details />
					<Privacy />
					<Platforms />
					<Stories />
					<Pricing />
					<Questions />
					<Download />
				</HeadingScope>
			</main>
			<SiteFooter />
		</DemoTheme>
	),
} satisfies DemoLanding;
