/**
 * The studio demo at `/demo/studio`: a landing for Quoin, an invented design and engineering
 * studio, set as a printed portfolio — bright cool paper, ink, one ultramarine, an oversized
 * Didone on a strict twelve-column grid, and each case study as a full-bleed plate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PaletteScale } from "~/resources/components/demo-theme";
import type { DemoLanding } from "~/resources/views/demos";

import DemoMiniature from "~/resources/components/demo-miniature";
import DemoTheme from "~/resources/components/demo-theme";
import StudioClients from "~/resources/views/demos/studio/clients";
import StudioEnquiry from "~/resources/views/demos/studio/enquiry";
import StudioFooter from "~/resources/views/demos/studio/footer";
import StudioHeader from "~/resources/views/demos/studio/header";
import StudioHero from "~/resources/views/demos/studio/hero";
import StudioNotes from "~/resources/views/demos/studio/notes";
import StudioPeople from "~/resources/views/demos/studio/people";
import StudioProcess from "~/resources/views/demos/studio/process";
import StudioSheet from "~/resources/views/demos/studio/sheet";
import StudioThumbnail from "~/resources/views/demos/studio/thumbnail";
import { DIDONE, GROTESK, MONO } from "~/resources/views/demos/studio/type";
import StudioWork from "~/resources/views/demos/studio/work";

/** Ultramarine, the one colour the page spends: the call to action, the open month, the guides. */
const BRAND: PaletteScale = [
	"oklch(0.97 0.014 268)",
	"oklch(0.935 0.03 268)",
	"oklch(0.87 0.065 268)",
	"oklch(0.77 0.11 268)",
	"oklch(0.65 0.16 268)",
	"oklch(0.54 0.19 268)",
	"oklch(0.47 0.2 268)",
	"oklch(0.4 0.18 268)",
	"oklch(0.32 0.14 268)",
	"oklch(0.25 0.1 268)",
	"oklch(0.17 0.06 268)",
];

/** Bright coated paper to blue-black ink: a cool, near-neutral ramp, a print room at night in dark. */
const NEUTRAL: PaletteScale = [
	"oklch(0.985 0.002 255)",
	"oklch(0.955 0.004 255)",
	"oklch(0.9 0.006 255)",
	"oklch(0.81 0.008 255)",
	"oklch(0.69 0.01 255)",
	"oklch(0.57 0.012 255)",
	"oklch(0.47 0.012 255)",
	"oklch(0.38 0.012 255)",
	"oklch(0.29 0.012 255)",
	"oklch(0.21 0.012 255)",
	"oklch(0.15 0.01 255)",
];

/**
 * The Didone for display, the grotesk for reading and the mono for captions; square corners
 * on every box and control, no shadows, and mono eyebrows, so the page reads as a printed
 * sheet set on a grid.
 */
const TOKENS = {
	"--ui-font-display": DIDONE,
	"--ui-font-sans": GROTESK,
	"--ui-font-mono": MONO,
	"--ui-landing-display-weight": "400",
	"--ui-landing-display-tracking": "-0.025em",
	"--ui-landing-chapter-size": "clamp(2.25rem, 5.5cqi, 4.5rem)",
	"--ui-landing-chapter-leading": "1.02",
	"--ui-landing-chapter-tracking": "-0.025em",
	"--ui-landing-measure": "84rem",
	"--ui-landing-cta-radius": "0",
	"--ui-landing-cta-weight": "500",
	"--ui-button-radius": "0",
	"--ui-radius-xs": "0",
	"--ui-radius-sm": "0",
	"--ui-radius-md": "0",
	"--ui-radius-lg": "0",
	"--ui-radius-xl": "0",
	"--ui-landing-radius-surface": "0",
	"--ui-landing-radius-frame": "0",
	"--ui-landing-card-radius-outer": "0",
	"--ui-landing-band-radius": "0",
	"--ui-landing-plan-radius": "0",
	"--ui-landing-plan-lift": "0 0 #0000",
	"--ui-landing-eyebrow-font": MONO,
	"--ui-landing-eyebrow-weight": "400",
	"--ui-landing-eyebrow-transform": "uppercase",
	"--ui-landing-eyebrow-tracking": "0.1em",
	"--ui-shadow-float": "none",
	"--ui-landing-band-glow": "none",
} as const;

/** The studio landing, from its own header to its own footer. */
export default {
	title: "Quoin — Design and engineering studio, Antwerp",
	kind: "Studio landing",
	tagline: "A design and engineering studio.",
	artDirection: "Printed portfolio: a Didone on a strict grid.",
	description:
		"Quoin designs and builds everyday software for transit, libraries and makers, and measures what it changed. Booking from March.",
	thumbnail: () => (
		<DemoMiniature brand={BRAND} neutral={NEUTRAL} tokens={TOKENS}>
			<StudioThumbnail />
		</DemoMiniature>
	),
	render: () => (
		<DemoTheme brand={BRAND} neutral={NEUTRAL} tokens={TOKENS}>
			<StudioSheet>
				<StudioHeader />
				<main>
					<StudioHero />
					<StudioWork />
					<StudioClients />
					<StudioProcess />
					<StudioPeople />
					<StudioNotes />
					<StudioEnquiry />
				</main>
				<StudioFooter />
			</StudioSheet>
		</DemoTheme>
	),
} satisfies DemoLanding;
