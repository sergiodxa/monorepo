/**
 * The open-source library demo landing: Plumb, an invented TypeScript schema library whose
 * schemas compile to plain JavaScript. Dark in both schemes, one acid-lime accent and mono
 * type throughout, and every band leads with code, a terminal or a measured figure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";

import type { DemoLanding } from "~/resources/views/demos";

import DemoMiniature from "~/resources/components/demo-miniature";
import DemoTheme from "~/resources/components/demo-theme";
import { BenchmarkChapter } from "~/resources/views/demos/library/benchmark";
import { ChangelogChapter } from "~/resources/views/demos/library/changelog";
import { ClosingBand } from "~/resources/views/demos/library/closing";
import { CommunityChapter } from "~/resources/views/demos/library/community";
import { CompileChapter } from "~/resources/views/demos/library/compile";
import { DocsChapter } from "~/resources/views/demos/library/docs-hub";
import { FaqSection } from "~/resources/views/demos/library/faq";
import { LibraryFooter } from "~/resources/views/demos/library/footer";
import { LibraryHeader } from "~/resources/views/demos/library/header";
import { LibraryHero } from "~/resources/views/demos/library/hero";
import { RuntimesChapter } from "~/resources/views/demos/library/runtimes";
import { SponsorsChapter } from "~/resources/views/demos/library/sponsors";
import PlumbThumbnail from "~/resources/views/demos/library/thumbnail";

/**
 * An acid lime at hue 128. Steps 400 to 600 all sit near full lightness, since the page is
 * dark in both schemes and reads them as text, ring and button fill; 800 to 950 are the
 * dim tints a band or hover takes behind them.
 */
const BRAND = [
	"oklch(0.985 0.03 125)",
	"oklch(0.965 0.07 125)",
	"oklch(0.945 0.13 126)",
	"oklch(0.925 0.18 127)",
	"oklch(0.9 0.2 128)",
	"oklch(0.88 0.21 128)",
	"oklch(0.86 0.215 129)",
	"oklch(0.78 0.2 129)",
	"oklch(0.42 0.11 129)",
	"oklch(0.3 0.075 129)",
	"oklch(0.2 0.045 129)",
] as const;

/** Near-black greys with a trace of green, so the lime reads as the only colour on the page. */
const NEUTRAL = [
	"oklch(0.985 0.003 160)",
	"oklch(0.955 0.004 160)",
	"oklch(0.9 0.006 160)",
	"oklch(0.81 0.008 160)",
	"oklch(0.71 0.01 160)",
	"oklch(0.6 0.01 160)",
	"oklch(0.5 0.01 160)",
	"oklch(0.4 0.01 160)",
	"oklch(0.29 0.01 160)",
	"oklch(0.2 0.008 160)",
	"oklch(0.135 0.006 160)",
] as const;

/** One mono stack for display, body, labels and code: the reader's system mono where neither named face is installed. */
const MONO =
	"'JetBrains Mono', 'Berkeley Mono', ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

/**
 * Syntax colours from the page's own inks: greys for structure, lime for literals, so code
 * carries the same single accent as the rest of the page.
 */
const SYNTAX = {
	"--highlight-comment": "var(--ui-color-neutral-500)",
	"--highlight-keyword": "var(--ui-color-neutral-400)",
	"--highlight-operator": "var(--ui-color-neutral-400)",
	"--highlight-punctuation": "var(--ui-color-neutral-500)",
	"--highlight-string": "var(--ui-color-brand-400)",
	"--highlight-builtin": "var(--ui-color-neutral-200)",
	"--highlight-attr-name": "var(--ui-color-neutral-300)",
	"--highlight-attr-value": "var(--ui-color-brand-400)",
	"--highlight-number": "var(--ui-color-brand-300)",
	"--highlight-boolean": "var(--ui-color-brand-300)",
	"--highlight-constant": "var(--ui-color-brand-300)",
	"--highlight-property": "var(--ui-color-neutral-300)",
	"--highlight-tag": "var(--ui-color-neutral-200)",
	"--highlight-function": "var(--ui-color-neutral-50)",
	"--highlight-class-name": "var(--ui-color-neutral-50)",
	"--highlight-regex": "var(--ui-color-brand-300)",
	"--highlight-variable": "var(--ui-color-neutral-200)",
	"--highlight-inserted": "var(--ui-color-brand-400)",
	"--highlight-deleted": "var(--ui-color-danger-400)",
} as const;

/**
 * Mono everywhere, a heavy tightly set display, 4px controls and 6px surfaces edged by a
 * white hairline instead of a shadow, lime mono eyebrows, and near-black text on the lime
 * button so the one accent is also the brightest thing on the page.
 */
const TOKENS = {
	...SYNTAX,
	"--ui-font-sans": MONO,
	"--ui-font-display": MONO,
	"--ui-font-mono": MONO,
	"--ui-brand-fg-on-solid": "var(--ui-color-neutral-950)",
	"--ui-landing-display-weight": "700",
	"--ui-landing-display-tracking": "-0.045em",
	"--ui-landing-display-max": "4rem",
	"--ui-landing-chapter-tracking": "-0.035em",
	"--ui-landing-chapter-size": "clamp(1.625rem, 1.2rem + 1.8cqi, 2.5rem)",
	"--ui-landing-lead-size": "1rem",
	"--ui-landing-lead-leading": "1.75rem",
	"--ui-landing-hero-lead-size": "1rem",
	"--ui-landing-hero-lead-leading": "1.7",
	"--ui-landing-cta-radius": "4px",
	"--ui-landing-cta-weight": "600",
	"--ui-button-radius": "4px",
	"--ui-landing-radius-surface": "6px",
	"--ui-landing-card-radius-outer": "6px",
	"--ui-landing-card-radius-inner": "3px",
	"--ui-landing-radius-frame": "6px",
	"--ui-landing-band-radius": "8px",
	"--ui-landing-plan-radius": "6px",
	"--ui-landing-hairline": "color-mix(in oklch, white 10%, transparent)",
	"--ui-shadow-surface": "0 0 0 1px var(--ui-landing-hairline)",
	"--ui-shadow-stage": "0 0 0 1px var(--ui-landing-hairline)",
	"--ui-shadow-control": "0 0 0 1px var(--ui-landing-hairline)",
	"--ui-shadow-float": "0 0 0 1px var(--ui-landing-hairline), 0 24px 48px -24px rgb(0 0 0 / 0.8)",
	"--ui-landing-eyebrow-font": "var(--ui-font-mono)",
	"--ui-landing-eyebrow-weight": "500",
	"--ui-landing-eyebrow-transform": "uppercase",
	"--ui-landing-eyebrow-tracking": "0.12em",
	"--ui-landing-eyebrow-color": "var(--ui-brand-fg)",
} as const;

/**
 * The Plumb page, dark in both schemes: the `dark` scope sits outside the theme, so its
 * tokens resolve against the dark semantic roles whatever the reader prefers. Every
 * in-page target clears the sticky bar when a link scrolls to it.
 */
export default {
	title: "plumb — Schemas that compile to plain ifs",
	kind: "Open-source library landing",
	tagline: "A TypeScript schema library that compiles.",
	artDirection: "Near-black, acid lime, mono everything.",
	description:
		"Plumb compiles a TypeScript schema to straight-line JavaScript once, so parsing runs the checks you would have written by hand.",
	thumbnail: () => (
		<div class="dark" mix={[raw({ display: "contents" })]}>
			<DemoMiniature brand={BRAND} neutral={NEUTRAL} tokens={TOKENS}>
				<PlumbThumbnail />
			</DemoMiniature>
		</div>
	),
	render: () => (
		<div class="dark" mix={[raw({ display: "contents" })]}>
			<DemoTheme brand={BRAND} neutral={NEUTRAL} tokens={TOKENS}>
				<LibraryHeader />
				<main id="top" mix={[when("& [id]", raw({ scrollMarginBlockStart: "4.5rem" }))]}>
					<LibraryHero />
					<CompileChapter />
					<BenchmarkChapter />
					<RuntimesChapter />
					<CommunityChapter />
					<ChangelogChapter />
					<DocsChapter />
					<SponsorsChapter />
					<FaqSection />
					<ClosingBand />
				</main>
				<LibraryFooter />
			</DemoTheme>
		</div>
	),
} satisfies DemoLanding;
