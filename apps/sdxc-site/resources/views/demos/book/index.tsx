/**
 * The book demo at `/demo/book`: a landing for The Measure, an invented web typography
 * book and video course, set as a printed page from `@sdxc/ui` landing patterns: ivory
 * paper, ink, one red, a serif throughout, square corners and ruled lines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PaletteScale } from "~/resources/components/demo-theme";
import type { DemoLanding } from "~/resources/views/demos";

import DemoTheme from "~/resources/components/demo-theme";
import BookAuthor from "~/resources/views/demos/book/author";
import BookClosing from "~/resources/views/demos/book/closing";
import BookContents from "~/resources/views/demos/book/contents";
import BookFaq from "~/resources/views/demos/book/faq";
import BookFooter from "~/resources/views/demos/book/footer";
import BookHeader from "~/resources/views/demos/book/header";
import BookHero from "~/resources/views/demos/book/hero";
import BookLearn from "~/resources/views/demos/book/learn";
import BookPaper from "~/resources/views/demos/book/paper";
import BookPress from "~/resources/views/demos/book/press";
import BookPricing from "~/resources/views/demos/book/pricing";
import BookProof from "~/resources/views/demos/book/proof";
import BookSample from "~/resources/views/demos/book/sample";
import BookTestimonials from "~/resources/views/demos/book/testimonials";
import { SERIF } from "~/resources/views/demos/book/type";

/** A printer's red ink, the one colour the page spends, deepest around the 600 step. */
const BRAND: PaletteScale = [
	"oklch(0.975 0.012 30)",
	"oklch(0.94 0.03 29)",
	"oklch(0.87 0.065 28)",
	"oklch(0.77 0.11 27)",
	"oklch(0.66 0.16 27)",
	"oklch(0.56 0.18 27)",
	"oklch(0.49 0.17 27)",
	"oklch(0.41 0.145 27)",
	"oklch(0.33 0.11 27)",
	"oklch(0.25 0.08 27)",
	"oklch(0.17 0.05 27)",
];

/** Ivory paper to ink: yellowed light steps and warm blacks, a dim reading room in dark. */
const NEUTRAL: PaletteScale = [
	"oklch(0.972 0.016 88)",
	"oklch(0.945 0.02 86)",
	"oklch(0.895 0.022 84)",
	"oklch(0.8 0.022 80)",
	"oklch(0.68 0.02 76)",
	"oklch(0.57 0.018 72)",
	"oklch(0.47 0.016 68)",
	"oklch(0.39 0.014 64)",
	"oklch(0.3 0.012 60)",
	"oklch(0.22 0.01 60)",
	"oklch(0.16 0.008 60)",
];

/**
 * One serif for every face, figures included; square corners on every box and control; and
 * edges drawn as rules. The page reads as print because every element on it is flat,
 * square and set in the book's own face.
 */
const TOKENS = {
	"--ui-font-display": SERIF,
	"--ui-font-sans": SERIF,
	"--ui-font-mono": SERIF,
	"--ui-marketing-display-weight": "400",
	"--ui-marketing-display-tracking": "-0.02em",
	"--ui-marketing-display-max": "5rem",
	"--ui-marketing-chapter-tracking": "-0.015em",
	"--ui-marketing-chapter-leading": "1.08",
	"--ui-marketing-lead-size": "1.1875rem",
	"--ui-marketing-cta-radius": "0",
	"--ui-marketing-cta-weight": "500",
	"--ui-button-radius": "0",
	"--ui-radius-xs": "0",
	"--ui-radius-sm": "0",
	"--ui-radius-md": "0",
	"--ui-radius-lg": "0",
	"--ui-radius-xl": "0",
	"--ui-marketing-radius-surface": "0",
	"--ui-marketing-radius-frame": "0",
	"--ui-marketing-card-radius-outer": "0",
	"--ui-marketing-band-radius": "0",
	"--ui-marketing-plan-radius": "0",
	"--ui-marketing-plan-lift": "0 0 #0000",
	"--ui-marketing-eyebrow-font": SERIF,
	"--ui-marketing-eyebrow-weight": "500",
	"--ui-marketing-eyebrow-transform": "uppercase",
	"--ui-marketing-eyebrow-tracking": "0.16em",
	"--ui-marketing-eyebrow-color": "var(--ui-brand-fg)",
	"--ui-shadow-control": "inset 0 0 0 1px var(--ui-neutral-border-strong)",
	"--ui-shadow-float": "none",
	"--ui-image-outline": "var(--ui-neutral-border-strong)",
} as const;

/** The book landing, from its own header to its own footer. */
export default {
	title: "The Measure — Web typography, set by hand",
	description:
		"A book and video course on web typography for designers and engineers: measure, rhythm, scale and fonts, with CSS for every chapter.",
	render: () => (
		<DemoTheme brand={BRAND} neutral={NEUTRAL} tokens={TOKENS}>
			<BookPaper>
				<BookHeader />
				<main>
					<BookHero />
					<BookPress />
					<BookSample />
					<BookContents />
					<BookLearn />
					<BookProof />
					<BookAuthor />
					<BookTestimonials />
					<BookPricing />
					<BookFaq />
					<BookClosing />
				</main>
				<BookFooter />
			</BookPaper>
		</DemoTheme>
	),
} satisfies DemoLanding;
