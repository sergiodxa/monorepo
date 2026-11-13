/**
 * The newsletter demo at `/demo/newsletter`: a home for Undercurrent, an invented letter
 * and podcast about everyday infrastructure, set like a well-written letter: one column on
 * cool writing paper, a humanist sans at a long leading, and one blue-black ink.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PaletteScale } from "~/resources/components/demo-theme";
import type { DemoLanding } from "~/resources/views/demos";

import DemoMiniature from "~/resources/components/demo-miniature";
import DemoTheme from "~/resources/components/demo-theme";
import NewsletterArchive from "~/resources/views/demos/newsletter/archive";
import NewsletterClosing from "~/resources/views/demos/newsletter/closing";
import NewsletterEpisodes from "~/resources/views/demos/newsletter/episodes";
import NewsletterFaq from "~/resources/views/demos/newsletter/faq";
import NewsletterFooter from "~/resources/views/demos/newsletter/footer";
import NewsletterHeader from "~/resources/views/demos/newsletter/header";
import NewsletterHero from "~/resources/views/demos/newsletter/hero";
import NewsletterHost from "~/resources/views/demos/newsletter/host";
import NewsletterLatest from "~/resources/views/demos/newsletter/latest";
import NewsletterLetters from "~/resources/views/demos/newsletter/letters";
import NewsletterMembership from "~/resources/views/demos/newsletter/membership";
import NewsletterSheet from "~/resources/views/demos/newsletter/sheet";
import NewsletterThumbnail from "~/resources/views/demos/newsletter/thumbnail";

/** A blue-black fountain-pen ink, the one colour the page spends, deepest around 600. */
const BRAND: PaletteScale = [
	"oklch(0.975 0.012 258)",
	"oklch(0.945 0.026 258)",
	"oklch(0.885 0.05 258)",
	"oklch(0.79 0.08 258)",
	"oklch(0.68 0.11 258)",
	"oklch(0.57 0.125 258)",
	"oklch(0.49 0.125 258)",
	"oklch(0.41 0.115 258)",
	"oklch(0.33 0.095 258)",
	"oklch(0.25 0.07 258)",
	"oklch(0.17 0.045 258)",
];

/** Cool writing paper to slate: light steps faintly blue, a night desk in dark. */
const NEUTRAL: PaletteScale = [
	"oklch(0.982 0.005 240)",
	"oklch(0.955 0.008 240)",
	"oklch(0.9 0.011 240)",
	"oklch(0.81 0.013 242)",
	"oklch(0.7 0.014 244)",
	"oklch(0.6 0.015 246)",
	"oklch(0.51 0.015 248)",
	"oklch(0.42 0.015 250)",
	"oklch(0.32 0.014 252)",
	"oklch(0.24 0.012 254)",
	"oklch(0.165 0.01 256)",
];

/** A humanist sans from the reader's own system: Seravek, Gill Sans, Calibri, Ubuntu. */
const HUMANIST =
	'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif';

/**
 * One column forty rems wide, a humanist sans everywhere, quiet display sizes at a medium
 * weight, long leading on every lead, and corners barely rounded, so the page reads as a
 * letter rather than a product sheet.
 */
const TOKENS = {
	"--ui-font-display": HUMANIST,
	"--ui-font-sans": HUMANIST,
	"--ui-landing-measure": "42rem",
	"--ui-landing-display-weight": "500",
	"--ui-landing-display-tracking": "-0.02em",
	"--ui-landing-display-max": "3.5rem",
	"--ui-landing-display-leading": "1.08",
	"--ui-landing-chapter-tracking": "-0.01em",
	"--ui-landing-chapter-leading": "1.15",
	"--ui-landing-lead-size": "1.125rem",
	"--ui-landing-lead-leading": "1.7",
	"--ui-landing-hero-lead-size": "1.1875rem",
	"--ui-landing-hero-lead-leading": "1.7",
	"--ui-landing-cta-radius": "0.25rem",
	"--ui-landing-cta-weight": "500",
	"--ui-button-radius": "0.25rem",
	"--ui-radius-sm": "0.25rem",
	"--ui-radius-md": "0.25rem",
	"--ui-radius-lg": "0.375rem",
	"--ui-radius-xl": "0.375rem",
	"--ui-landing-radius-surface": "0.375rem",
	"--ui-landing-radius-frame": "0.375rem",
	"--ui-landing-card-radius-outer": "0.375rem",
	"--ui-landing-plan-radius": "0.375rem",
	"--ui-landing-plan-lift": "0 0 #0000",
	"--ui-landing-eyebrow-font": HUMANIST,
	"--ui-landing-eyebrow-weight": "500",
	"--ui-landing-eyebrow-transform": "uppercase",
	"--ui-landing-eyebrow-tracking": "0.14em",
	"--ui-landing-eyebrow-color": "var(--ui-brand-fg)",
	"--ui-shadow-float": "none",
} as const;

/** The newsletter landing, from its own header to its own footer. */
export default {
	title: "Undercurrent — Letters from under the street",
	kind: "Newsletter and podcast",
	tagline: "A letter and podcast about everyday infrastructure.",
	artDirection: "Cool writing paper, one column, blue-black ink.",
	description:
		"A fortnightly letter and podcast about the water mains, power lines, signals and post under an ordinary day, read aloud with the people who run them.",
	thumbnail: () => (
		<DemoMiniature brand={BRAND} neutral={NEUTRAL} tokens={TOKENS}>
			<NewsletterThumbnail />
		</DemoMiniature>
	),
	render: () => (
		<DemoTheme brand={BRAND} neutral={NEUTRAL} tokens={TOKENS}>
			<NewsletterSheet>
				<NewsletterHeader />
				<main>
					<NewsletterHero />
					<NewsletterLatest />
					<NewsletterEpisodes />
					<NewsletterArchive />
					<NewsletterHost />
					<NewsletterLetters />
					<NewsletterMembership />
					<NewsletterFaq />
					<NewsletterClosing />
				</main>
				<NewsletterFooter />
			</NewsletterSheet>
		</DemoTheme>
	),
} satisfies DemoLanding;
