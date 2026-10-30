/**
 * The book demo at `/demo/book`: a landing for The Measure, an invented web typography
 * book and video course, built from `@sdxc/ui` landing patterns under a warm paper palette,
 * a rust brand and a serif display face from the system's own fonts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LinkButton } from "@sdxc/ui";
import { ClosingCta } from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

import type { PaletteScale } from "~/resources/components/demo-theme";
import type { DemoLanding } from "~/resources/views/demos";

import DemoTheme from "~/resources/components/demo-theme";
import BookAuthor from "~/resources/views/demos/book/author";
import BookContents from "~/resources/views/demos/book/contents";
import BookFaq from "~/resources/views/demos/book/faq";
import BookFooter from "~/resources/views/demos/book/footer";
import BookHeader from "~/resources/views/demos/book/header";
import BookHero from "~/resources/views/demos/book/hero";
import BookLearn from "~/resources/views/demos/book/learn";
import BookPricing from "~/resources/views/demos/book/pricing";
import BookProof from "~/resources/views/demos/book/proof";
import BookSample from "~/resources/views/demos/book/sample";
import BookTestimonials from "~/resources/views/demos/book/testimonials";

/** A rust red, the colour of the cover's cloth, peaking in chroma around the 500 step. */
const BRAND: PaletteScale = [
	"oklch(0.985 0.012 45)",
	"oklch(0.955 0.03 42)",
	"oklch(0.9 0.06 40)",
	"oklch(0.81 0.1 38)",
	"oklch(0.71 0.14 36)",
	"oklch(0.61 0.17 34)",
	"oklch(0.52 0.17 33)",
	"oklch(0.43 0.15 32)",
	"oklch(0.33 0.11 32)",
	"oklch(0.245 0.08 32)",
	"oklch(0.165 0.05 32)",
];

/** Warm greys that read as paper in light mode and as a dim reading room in dark. */
const NEUTRAL: PaletteScale = [
	"oklch(0.985 0.006 80)",
	"oklch(0.955 0.009 75)",
	"oklch(0.9 0.011 72)",
	"oklch(0.81 0.013 70)",
	"oklch(0.71 0.014 68)",
	"oklch(0.61 0.014 65)",
	"oklch(0.52 0.013 62)",
	"oklch(0.43 0.012 60)",
	"oklch(0.33 0.01 58)",
	"oklch(0.245 0.008 55)",
	"oklch(0.165 0.006 55)",
];

/** A bookish display face from the system's serifs, set lighter and looser than a sans. */
const TOKENS = {
	"--ui-font-display":
		'"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
	"--ui-marketing-display-weight": "400",
	"--ui-marketing-display-tracking": "-0.02em",
	"--ui-marketing-chapter-tracking": "-0.015em",
	"--ui-marketing-display-max": "5rem",
	"--ui-marketing-cta-radius": "9999px",
} as const;

/** The book landing, from its own header to its own footer. */
export default {
	title: "The Measure — Web typography, set by hand",
	description:
		"A book and video course on web typography for designers and engineers: measure, rhythm, scale and fonts, with CSS for every chapter.",
	render: () => (
		<DemoTheme brand={BRAND} neutral={NEUTRAL} tokens={TOKENS}>
			<BookHeader />
			<main>
				<BookHero />
				<BookProof />
				<BookLearn />
				<BookContents />
				<BookSample />
				<BookAuthor />
				<BookTestimonials />
				<BookPricing />
				<BookFaq />
				<ClosingCta
					inset
					tone="brand"
					title="Your next paragraph could read better"
					description="Start with the free chapter, or get the whole book and every lesson today."
					actions={
						<>
							<LinkButton href="#pricing" color="neutral" mix={[marketingCtaChrome()]}>
								Buy the book
							</LinkButton>
							<LinkButton href="#sample" variant="ghost" mix={[marketingCtaChrome()]}>
								Read chapter 2 free
							</LinkButton>
						</>
					}
				/>
			</main>
			<BookFooter />
		</DemoTheme>
	),
} satisfies DemoLanding;
