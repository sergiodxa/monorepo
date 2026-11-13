/**
 * The conference demo at `/demo/conference`: a landing for Overprint 2027, an invented
 * one-day web platform conference in Rotterdam, printed as a loud two-ink risograph poster:
 * fluorescent pink over riso blue on newsprint, condensed black type and grain on everything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PaletteScale } from "~/resources/components/demo-theme";
import type { DemoLanding } from "~/resources/views/demos";

import DemoMiniature from "~/resources/components/demo-miniature";
import DemoTheme from "~/resources/components/demo-theme";
import ConferenceClosing from "~/resources/views/demos/conference/closing";
import ConferenceConduct from "~/resources/views/demos/conference/conduct";
import ConferenceFooter from "~/resources/views/demos/conference/footer";
import ConferenceHeader from "~/resources/views/demos/conference/header";
import ConferenceHero from "~/resources/views/demos/conference/hero";
import { DISPLAY, MONO, SANS } from "~/resources/views/demos/conference/ink";
import ConferencePoster from "~/resources/views/demos/conference/poster";
import ConferenceSchedule from "~/resources/views/demos/conference/schedule";
import ConferenceSpeakers from "~/resources/views/demos/conference/speakers";
import ConferenceSponsors from "~/resources/views/demos/conference/sponsors";
import ConferenceTalks from "~/resources/views/demos/conference/talks";
import ConferenceThumbnail from "~/resources/views/demos/conference/thumbnail";
import ConferenceTicker from "~/resources/views/demos/conference/ticker";
import ConferenceTickets from "~/resources/views/demos/conference/tickets";
import ConferenceTravel from "~/resources/views/demos/conference/travel";
import ConferenceVenue from "~/resources/views/demos/conference/venue";

/**
 * Fluorescent pink, deepened from the 600 step so white type on a button holds 4.5:1 while the
 * 400 and 500 steps keep the drum's glow for display ink.
 */
const BRAND: PaletteScale = [
	"oklch(0.97 0.02 356)",
	"oklch(0.93 0.05 356)",
	"oklch(0.87 0.1 356)",
	"oklch(0.8 0.15 356)",
	"oklch(0.72 0.2 356)",
	"oklch(0.65 0.24 356)",
	"oklch(0.56 0.22 356)",
	"oklch(0.48 0.19 356)",
	"oklch(0.39 0.15 356)",
	"oklch(0.3 0.11 356)",
	"oklch(0.2 0.07 356)",
];

/**
 * Newsprint to riso blue: the light steps are warm unbleached paper, the dark steps the blue
 * drum, so body text prints in blue ink and the dark page is a blue-black sheet.
 */
const NEUTRAL: PaletteScale = [
	"oklch(0.962 0.02 92)",
	"oklch(0.93 0.022 92)",
	"oklch(0.87 0.022 100)",
	"oklch(0.78 0.03 230)",
	"oklch(0.67 0.06 250)",
	"oklch(0.56 0.1 255)",
	"oklch(0.47 0.13 258)",
	"oklch(0.4 0.14 259)",
	"oklch(0.32 0.13 260)",
	"oklch(0.25 0.11 262)",
	"oklch(0.16 0.05 264)",
];

/**
 * Square corners, no shadows and ink rules for every edge; a condensed black display face
 * at poster sizes; mono uppercase eyebrows in pink. The two drum colours are tokens of their
 * own, each with a dark-sheet value.
 */
const TOKENS = {
	"--op-pink": "light-dark(oklch(0.64 0.25 356), oklch(0.72 0.21 356))",
	"--op-blue": "light-dark(oklch(0.45 0.16 258), oklch(0.74 0.12 242))",
	"--ui-font-display": DISPLAY,
	"--ui-font-sans": SANS,
	"--ui-font-mono": MONO,
	"--ui-landing-display-weight": "900",
	"--ui-landing-display-tracking": "0",
	"--ui-landing-display-max": "9rem",
	"--ui-landing-chapter-size": "clamp(2.75rem, 1.6rem + 4.6cqi, 5.25rem)",
	"--ui-landing-chapter-leading": "0.88",
	"--ui-landing-chapter-tracking": "0",
	"--ui-landing-lead-size": "1.125rem",
	"--ui-landing-cta-radius": "0",
	"--ui-landing-cta-weight": "700",
	"--ui-button-radius": "0",
	"--ui-radius-xs": "0",
	"--ui-radius-sm": "0",
	"--ui-radius-md": "0",
	"--ui-radius-lg": "0",
	"--ui-radius-xl": "0",
	"--ui-landing-radius-surface": "0",
	"--ui-landing-radius-frame": "0",
	"--ui-landing-card-radius-outer": "0",
	"--ui-landing-card-radius-inner": "0",
	"--ui-landing-band-radius": "0",
	"--ui-landing-plan-radius": "0",
	"--ui-landing-plan-lift": "0 0 #0000",
	"--ui-landing-hairline": "color-mix(in oklch, var(--op-blue) 40%, transparent)",
	"--ui-shadow-surface": "0 0 0 2px var(--op-blue)",
	"--ui-shadow-stage": "0 0 0 2px var(--op-blue)",
	"--ui-shadow-control": "inset 0 0 0 2px var(--op-blue)",
	"--ui-shadow-float": "none",
	"--ui-landing-eyebrow-font": MONO,
	"--ui-landing-eyebrow-weight": "700",
	"--ui-landing-eyebrow-transform": "uppercase",
	"--ui-landing-eyebrow-tracking": "0.12em",
	"--ui-landing-eyebrow-color": "var(--ui-brand-fg)",
	"--ui-image-outline": "var(--op-blue)",
} as const;

/** The conference landing, from its own bar to its own footer. */
export default {
	title: "Overprint 2027 — A one-day web platform conference in Rotterdam",
	kind: "Event landing",
	tagline: "A one-day web platform conference.",
	artDirection: "Riso pink over blue, condensed black, grain.",
	description:
		"Overprint is one day of talks on what browsers ship, in two rooms of an old foundry in Rotterdam, on Thursday 15 April 2027.",
	thumbnail: () => (
		<DemoMiniature brand={BRAND} neutral={NEUTRAL} tokens={TOKENS}>
			<ConferenceThumbnail />
		</DemoMiniature>
	),
	render: () => (
		<DemoTheme brand={BRAND} neutral={NEUTRAL} tokens={TOKENS}>
			<ConferencePoster>
				<ConferenceHeader />
				<main id="top">
					<ConferenceHero />
					<ConferenceTicker />
					<ConferenceSchedule />
					<ConferenceSpeakers />
					<ConferenceVenue />
					<ConferenceTickets />
					<ConferenceTalks />
					<ConferenceSponsors />
					<ConferenceTravel />
					<ConferenceConduct />
					<ConferenceClosing />
				</main>
				<ConferenceFooter />
			</ConferencePoster>
		</DemoTheme>
	),
} satisfies DemoLanding;
