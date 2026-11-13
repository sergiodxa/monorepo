/**
 * The AI product demo at `/demo/ai`: a landing for Margin, an invented assistant that turns
 * meeting recordings into notes where every line cites its source. Set as a notebook: warm
 * paper, ballpoint blue, a red margin line and a yellow highlighter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PaletteScale } from "~/resources/components/demo-theme";
import type { DemoLanding } from "~/resources/views/demos";

import DemoMiniature from "~/resources/components/demo-miniature";
import DemoTheme from "~/resources/components/demo-theme";
import MarginClosing from "~/resources/views/demos/ai/closing";
import MarginFaq from "~/resources/views/demos/ai/faq";
import MarginFooter from "~/resources/views/demos/ai/footer";
import MarginHeader from "~/resources/views/demos/ai/header";
import MarginHero from "~/resources/views/demos/ai/hero";
import MarginIntegrations from "~/resources/views/demos/ai/integrations";
import MarginLimits from "~/resources/views/demos/ai/limits";
import MarginPaper from "~/resources/views/demos/ai/paper";
import MarginPricing, { BILL_FRAME, MarginBill } from "~/resources/views/demos/ai/pricing";
import MarginPrivacy from "~/resources/views/demos/ai/privacy";
import MarginSources from "~/resources/views/demos/ai/sources";
import MarginThumbnail from "~/resources/views/demos/ai/thumbnail";
import { MONO, SANS } from "~/resources/views/demos/ai/type";
import MarginWriting from "~/resources/views/demos/ai/writing";

/** Ballpoint blue, the ink of the actions, the timestamps and the hand-written margin. */
const BRAND: PaletteScale = [
	"oklch(0.985 0.01 262)",
	"oklch(0.955 0.025 262)",
	"oklch(0.9 0.05 262)",
	"oklch(0.81 0.09 262)",
	"oklch(0.71 0.13 262)",
	"oklch(0.61 0.16 262)",
	"oklch(0.52 0.17 262)",
	"oklch(0.43 0.16 262)",
	"oklch(0.33 0.12 262)",
	"oklch(0.245 0.08 262)",
	"oklch(0.165 0.05 262)",
];

/** Cream notebook paper to a warm graphite, so dark mode reads as the page under a lamp. */
const NEUTRAL: PaletteScale = [
	"oklch(0.982 0.012 85)",
	"oklch(0.958 0.016 84)",
	"oklch(0.905 0.018 82)",
	"oklch(0.81 0.018 80)",
	"oklch(0.69 0.017 76)",
	"oklch(0.58 0.016 72)",
	"oklch(0.48 0.014 68)",
	"oklch(0.4 0.012 64)",
	"oklch(0.31 0.01 62)",
	"oklch(0.23 0.009 60)",
	"oklch(0.17 0.008 60)",
];

/**
 * A typed sans for the notes and headings, ink-blue mono for labels and times like a
 * stamped page header, small soft corners like a cut sheet of paper, and tinted bands as
 * flat as the paper they are printed on.
 */
const TOKENS = {
	"--ui-font-sans": SANS,
	"--ui-font-display": SANS,
	"--ui-font-mono": MONO,
	"--ui-landing-display-weight": "650",
	"--ui-landing-display-tracking": "-0.03em",
	"--ui-landing-display-max": "4.25rem",
	"--ui-landing-cta-radius": "0.5rem",
	"--ui-button-radius": "0.5rem",
	"--ui-landing-radius-surface": "0.5rem",
	"--ui-landing-radius-frame": "0.5rem",
	"--ui-landing-card-radius-outer": "0.5rem",
	"--ui-landing-card-radius-inner": "0.25rem",
	"--ui-landing-plan-radius": "0.5rem",
	"--ui-landing-band-radius": "1rem",
	"--ui-landing-band-glow": "none",
	"--ui-landing-eyebrow-weight": "500",
	"--ui-landing-eyebrow-color": "var(--ui-brand-fg)",
} as const;

/** The AI product landing, from its own header to its own footer. */
export default {
	title: "Margin — Meeting notes that cite their sources",
	kind: "AI product landing",
	tagline: "Meeting notes where every line links to its source.",
	artDirection: "Warm paper, ballpoint ink, a highlighter.",
	description:
		"An invented AI note-taker for recorded meetings: summaries, decisions and to-dos that each link to the transcript line they came from.",
	thumbnail: () => (
		<DemoMiniature brand={BRAND} neutral={NEUTRAL} tokens={TOKENS}>
			<MarginThumbnail />
		</DemoMiniature>
	),
	target: (name, url) => (name === BILL_FRAME ? <MarginBill url={url} /> : null),
	render: (url) => (
		<DemoTheme brand={BRAND} neutral={NEUTRAL} tokens={TOKENS}>
			<MarginPaper>
				<MarginHeader />
				<main>
					<MarginHero />
					<MarginSources />
					<MarginWriting />
					<MarginLimits />
					<MarginPrivacy />
					<MarginIntegrations />
					<MarginPricing url={url} />
					<MarginFaq />
					<MarginClosing />
				</main>
				<MarginFooter />
			</MarginPaper>
		</DemoTheme>
	),
} satisfies DemoLanding;
