/**
 * The Foundations of `@sdxc/ui/landing`: what the marketing bands are for, the band, type
 * and motion rules every one of them follows, and each variable the namespace reads, with
 * the default `theme.css` or the component's own fallback gives it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Foundations } from "~/resources/content/foundations";

const LANDING: Foundations = {
	module: "landing",
	slug: "landing-foundations",
	title: "Landing foundations",
	summary:
		"What @sdxc/ui/landing is for, the band, type and motion rules its parts share, and every variable it reads.",
	importPath: "@sdxc/ui/landing",
	source: "ui/src/styles/landing.ts",
	intro: [
		"Marketing pages built from bands: a hero, proof, feature bands, pricing, an FAQ and a closing call to action, plus the frames, code stages and diagrams that show a product working.",
		"Copy comes in as props and the look comes from a few tokens, so one palette and a handful of variables set the art direction for every band.",
	],
	reachFor: [
		"A product home, feature, audience, comparison or pricing page.",
		"A book, course or app landing that sells one thing from top to bottom.",
		"Any page read top to bottom as a story, where the general components would read as an app screen.",
	],
	ideas: [
		{
			title: "Bands",
			body: "`LandingSection` paints a `tone` and picks one of four `spacing` steps; `inverse` and `brand` re-point the text tokens so content stays legible.",
		},
		{
			title: "Container sizing",
			body: "Each band is a container and its tokens are fluid in `cqi`, so it tracks its own width, not the viewport.",
		},
		{
			title: "Heading levels",
			body: "The hero owns the one `h1`; each band opens a `HeadingScope` one level deeper, and `size` sets the look apart from the level.",
		},
		{
			title: "Hairlines and surfaces",
			body: "Edges use `--ui-landing-hairline` and cards sit on `--ui-surface-raised`; both switch for dark mode and `prefers-contrast: more`.",
		},
		{
			title: "Motion",
			body: "Entrances and loops run only under `prefers-reduced-motion: no-preference`; `MotionLoop` adds a pause control.",
		},
		{
			title: "Accessibility",
			body: "Decorative visuals are `aria-hidden`, and header controls reach `--ui-target-size` (44px on a coarse pointer).",
		},
	],
	roles:
		"Reads the neutral and brand roles, success and danger in a few diagrams, and the raw neutral and brand scales for band fills.",
	variables: [
		{
			title: "Layout and spacing",
			lead: "Declared on `:root` in `theme.css`. The spacing steps are fluid in the band's container, so override them with a `clamp()` rather than a fixed length.",
			variables: [
				{
					name: "--ui-landing-measure",
					default: "72rem",
					controls: "Widest the centered content column of every band grows.",
				},
				{
					name: "--ui-landing-gutter",
					default: "1rem",
					controls:
						"Inline padding at the narrowest step; it grows to 1.5rem and 2rem with the band.",
				},
				{
					name: "--ui-landing-section-space",
					default: "clamp(5rem, 3.86rem + 4.85cqi, 7.5rem)",
					controls: "Block padding of a normal band.",
				},
				{
					name: "--ui-landing-section-space-compact",
					default: "clamp(3rem, 2.32rem + 2.91cqi, 4.5rem)",
					controls: "Block padding of a compact band.",
				},
				{
					name: "--ui-landing-section-space-hero",
					default: "clamp(3.5rem, 1.45rem + 8.73cqi, 8rem)",
					controls: "Block padding of a hero band.",
				},
				{
					name: "--ui-landing-section-space-cta",
					default: "clamp(5rem, 4.09rem + 3.88cqi, 7rem)",
					controls: "Block padding of a closing call-to-action band.",
				},
				{
					name: "--ui-landing-header-space",
					default: "clamp(2.5rem, 1.82rem + 2.91cqi, 4rem)",
					controls: "Gap between a `LandingHeader` and the band body under it.",
				},
				{
					name: "--ui-landing-header-end",
					default: "--ui-landing-header-space",
					controls: "One header's own gap; bands that lay out their header themselves set it to 0.",
				},
				{
					name: "--ui-landing-header-height",
					default: "4rem",
					controls: "Height of the sticky site header, which sticky stage content clears.",
				},
				{
					name: "--ui-landing-band-radius",
					default: "2rem",
					controls: "Corner radius of an inset band's panel.",
				},
			],
		},
		{
			title: "Type",
			lead: "Display and chapter titles come from `displayHeading()` and `Heading`'s display and chapter sizes; leads from `landingLead()`.",
			variables: [
				{
					name: "--ui-font-display",
					default: "var(--ui-font-sans)",
					controls: "Family of display and chapter titles.",
				},
				{
					name: "--ui-landing-display-size",
					default: "clamp(2.625rem, 1.77rem + 3.64cqi, var(--ui-landing-display-max))",
					controls: "Size of the page's h1; a split hero sets a smaller clamp.",
				},
				{
					name: "--ui-landing-display-max",
					default: "4.5rem",
					controls: "Top of the fluid display size.",
				},
				{
					name: "--ui-landing-display-tracking",
					default: "-0.035em",
					controls: "Letter spacing of the page's h1.",
				},
				{
					name: "--ui-landing-display-weight",
					default: "500",
					controls: "Weight of display and chapter titles.",
				},
				{
					name: "--ui-landing-display-leading",
					default: "min(calc(0.875em + 0.5625rem), calc(0.6em + 1.8rem))",
					controls: "Line height of the h1, tightening as it grows.",
				},
				{
					name: "--ui-landing-chapter-size",
					default: "clamp(1.75rem, 1.18rem + 2.42cqi, 3rem)",
					controls: "Size of a band's chapter title.",
				},
				{
					name: "--ui-landing-chapter-leading",
					default: "1.1",
					controls: "Line height of chapter titles.",
				},
				{
					name: "--ui-landing-chapter-tracking",
					default: "-0.025em",
					controls: "Letter spacing of chapter titles.",
				},
				{
					name: "--ui-landing-lead-measure",
					default: "40rem",
					controls: "Widest a lead under a title grows.",
				},
				{ name: "--ui-landing-lead-size", default: "1.125rem", controls: "Size of a band's lead." },
				{
					name: "--ui-landing-lead-leading",
					default: "2rem",
					controls: "Line height of a band's lead.",
				},
				{ name: "--ui-landing-lead-weight", default: "400", controls: "Weight of a lead." },
				{
					name: "--ui-landing-hero-lead-size",
					default: "clamp(1.0625rem, 0.98rem + 0.4cqi, 1.25rem)",
					controls: "Size of the hero's lead.",
				},
				{
					name: "--ui-landing-hero-lead-leading",
					default: "1.55",
					controls: "Line height of the hero's lead.",
				},
				{
					name: "--ui-landing-eyebrow-font",
					default: "var(--ui-font-mono)",
					controls: "Family of the mono eyebrow above a title.",
				},
				{ name: "--ui-landing-eyebrow-weight", default: "600", controls: "Weight of the eyebrow." },
				{
					name: "--ui-landing-eyebrow-transform",
					default: "uppercase",
					controls: "Letter case of the eyebrow.",
				},
				{
					name: "--ui-landing-eyebrow-tracking",
					default: "0.1em",
					controls: "Letter spacing of the eyebrow.",
				},
				{
					name: "--ui-landing-eyebrow-color",
					default: "var(--ui-neutral-fg-muted)",
					controls: "Ink of the eyebrow; inverse and brand bands re-point it.",
				},
				{
					name: "--ui-landing-accent-color",
					default: "var(--ui-brand-fg)",
					controls: "Ink of the phrase `AccentText` stresses inside a title.",
				},
			],
		},
		{
			title: "Calls to action and logos",
			variables: [
				{
					name: "--ui-landing-cta-radius",
					default: "0.5rem",
					controls: "Corner radius of landing calls to action; 9999px makes pills.",
				},
				{
					name: "--ui-landing-cta-weight",
					default: "600",
					controls: "Weight of a call to action's label.",
				},
				{
					name: "--ui-landing-cta-height",
					default: "auto",
					controls: "Fixed height of a call to action.",
				},
				{
					name: "--ui-landing-logo-height",
					default: "1.75rem",
					controls: "Height of a mark in a logo cloud or marquee.",
				},
				{
					name: "--ui-landing-logo-height-lg",
					default: "2.25rem",
					controls: "Mark height from the lg container width up.",
				},
				{
					name: "--ui-landing-logo-tile",
					default: "4% of --ui-neutral-fg-emphasis over --ui-bg",
					controls: "Fill behind each mark in a tiled logo cloud.",
				},
				{
					name: "--ui-landing-tile-radius",
					default: "0.5rem",
					controls: "Corner radius of a logo cloud's tiles.",
				},
			],
		},
		{
			title: "Surfaces, edges and radii",
			lead: "`theme.css` declares the dark values under `.dark` and `prefers-color-scheme: dark`, and solid strong borders under `prefers-contrast: more`.",
			variables: [
				{
					name: "--ui-landing-hairline",
					default: "6% of --ui-neutral-fg-emphasis; 10% white in dark",
					controls: "The translucent line every landing rule, grid and edge draws with.",
				},
				{
					name: "--ui-surface-raised",
					default: "white; a neutral 900–950 mix in dark",
					controls: "Fill of frames, cards, code stages and the header above a band.",
				},
				{
					name: "--ui-shadow-surface",
					default: "0 0 0 1px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.05)",
					controls: "Edge of a raised card: a ring and a small drop.",
				},
				{
					name: "--ui-shadow-stage",
					default: "0 0 0 1px rgb(0 0 0 / 0.06), 0 12px 32px -12px rgb(0 0 0 / 0.18)",
					controls: "Deeper shadow under a staged `ProductFrame`.",
				},
				{
					name: "--ui-shadow-control",
					default: "a 1px drop with an inset highlight and ring",
					controls: "Edge of calls to action, header controls and the active stage tab.",
				},
				{
					name: "--ui-shadow-float",
					default: "0 25px 50px -12px rgb(0 0 0 / 0.15)",
					controls: "Shadow of the floating site header.",
				},
				{
					name: "--ui-image-outline",
					default: "rgb(0 0 0 / 0.1); rgb(255 255 255 / 0.1) in dark",
					controls: "Inset line that keeps a photo's edge visible on a same-tone fill.",
				},
				{
					name: "--ui-landing-radius-surface",
					default: "1rem",
					controls: "Corner radius of staged cards and panels.",
				},
				{
					name: "--ui-landing-radius-frame",
					default: "0.75rem",
					controls: "Corner radius of product frames, code stages and tabbed stages.",
				},
				{
					name: "--ui-landing-card-radius-outer",
					default: "1.5rem",
					controls: "Radius of a card grid's corners on its outer edge.",
				},
				{
					name: "--ui-landing-card-radius-inner",
					default: "0.5rem",
					controls: "Radius of card corners that face a neighbour.",
				},
				{
					name: "--ui-landing-plan-radius",
					default: "1.5rem",
					controls: "Corner radius of every pricing plan.",
				},
				{
					name: "--ui-landing-plan-lift",
					default: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
					controls: "Shadow lifting the featured plan; none flattens it.",
				},
			],
		},
		{
			title: "Band fills",
			lead: "Read by `landingBandTone()`; none is declared in `theme.css`, so each default is the fallback in the code.",
			variables: [
				{
					name: "--ui-landing-band-tint",
					default: "var(--ui-color-neutral-100)",
					controls: "Fill of a tinted band in light mode.",
				},
				{
					name: "--ui-landing-band-tint-dark",
					default: "var(--ui-neutral-bg-tint)",
					controls: "Fill of a tinted band in dark mode.",
				},
				{
					name: "--ui-landing-band-glow",
					default: "a quiet radial brand glow from the top corner",
					controls: "Image over a tinted band; none drops the glow.",
				},
				{
					name: "--ui-landing-brand-band",
					default: "var(--ui-color-brand-700)",
					controls: "Fill of a brand band.",
				},
				{
					name: "--ui-landing-band-gradient",
					default: "none",
					controls: "Image a gradient band paints; the page supplies it.",
				},
				{
					name: "--ui-landing-band-gradient-base",
					default: "transparent",
					controls: "Color under the gradient band's image.",
				},
				{
					name: "--ui-code-stage-inset",
					default: "1rem",
					controls: "Inline start of a `CodeStage`'s code; its header lines up with it.",
				},
			],
		},
		{
			title: "Set by the components",
			lead: "Written by a component from its props or its content, and read back by its own parts. Leave them unset.",
			variables: [
				{
					name: "--ui-landing-cell-padding-block, --ui-landing-cell-padding-inline",
					default: "set per cell by the card grid",
					controls: "A cell's padding, which its media slot bleeds through.",
				},
				{
					name: "--ui-code-stage-gutter",
					default: "set by CodeStage from its line count",
					controls: "Width of the line-number gutter.",
				},
				{
					name: "--ui-sponsor-wall-columns, -cell, -logo, -pad",
					default: "set per tier by SponsorWall",
					controls: "Columns, cell height, logo height and padding of one sponsor tier.",
				},
				{
					name: "--ui-fan-<part>-n, --ui-fan-<part>-w",
					default: "set per node by FanOutDiagram",
					controls: "Grid placement and bus lines of each node, narrow and wide.",
				},
			],
		},
	],
};

export default LANDING;
