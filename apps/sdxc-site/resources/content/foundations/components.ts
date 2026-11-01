/**
 * The Foundations of the root `@sdxc/ui` components: what the general catalogue is for, the
 * heading, platform, target and motion rules every component follows, and each non-color
 * variable they read or the themes declare, with its default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Foundations } from "~/resources/content/foundations";

const COMPONENTS: Foundations = {
	module: "components",
	slug: "foundations",
	title: "Foundations",
	summary:
		"What the general @sdxc/ui components are for, the rules every one follows, and every non-color variable they read.",
	importPath: "@sdxc/ui",
	source: "ui/src/theme.css",
	intro: [
		"The general catalogue: forms, overlays, navigation, feedback, layout and type, rendered as server HTML. Every namespace builds on it.",
		"Colors come from the roles on Theming and shape from the variables below, so you retune a component by setting a variable.",
	],
	reachFor: [
		"Any page, app or marketing: these are the parts every other namespace composes.",
		"Forms, dialogs, menus, popovers, tabs and the other controls a product needs.",
		"A component you want to own: sdxc ui add copies one into your project to edit.",
	],
	ideas: [
		{
			title: "Ambient headings",
			body: "`Heading` takes its level from the nearest `HeadingScope`; `size` sets the look apart from the level.",
		},
		{
			title: "Platform first",
			body: "Overlays use `<dialog>`, the Popover API and Invoker Commands; only `DialogDismiss` is an island.",
		},
		{
			title: "Color by role",
			body: "`color` takes `brand`, `neutral`, `success`, `warning` or `danger`; no component hard-codes a hue.",
		},
		{
			title: "Targets",
			body: "Small controls grow an invisible hit area to `--ui-target-size`, 44px on a coarse pointer.",
		},
		{
			title: "Names checked",
			body: "Icon-only controls and landmarks warn in development without an accessible name.",
		},
		{
			title: "Motion",
			body: "`spin`, `pulse` and `shimmer` are CSS keyframes that soften under `prefers-reduced-motion`.",
		},
		{
			title: "Both directions",
			body: "Logical properties and `:dir(rtl)` mirroring keep one markup for both writing directions.",
		},
	],
	roles:
		"Reads every role, brand, neutral, success, warning and danger; the Theming page lists them with their light and dark values.",
	variables: [
		{
			title: "Scales",
			lead: "`@sdxc/u`'s `theme.css` declares spacing, fonts, type and container sizes; radius and shadow are read with these defaults, and declaring one restyles every component.",
			variables: [
				{
					name: "--ui-spacing",
					default: "0.25rem",
					controls: "Unit of every numeric gap, padding and size step.",
				},
				{
					name: "--ui-font-sans",
					default: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
					controls: "Body face.",
				},
				{
					name: "--ui-font-serif",
					default: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
					controls: "Serif face.",
				},
				{
					name: "--ui-font-mono",
					default: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
					controls: "Code face.",
				},
				{
					name: "--ui-font-display",
					default: "var(--ui-font-sans)",
					controls: "Face of `Heading`'s `display` and `chapter` sizes.",
				},
				{
					name: "--ui-text-xs … --ui-text-9xl",
					default: "0.75rem, 0.875rem, 1rem, 1.125rem, 1.25rem … 8rem",
					controls: "The type size scale.",
				},
				{
					name: "--ui-container-xs … --ui-container-2xl",
					default: "20rem, 24rem, 36rem, 48rem, 64rem, 80rem",
					controls: "The container widths components step at.",
				},
				{
					name: "--ui-radius-none … --ui-radius-full",
					default: "0px, 0.25rem, 0.375rem, 0.5rem, 0.75rem, 9999px (none, sm, md, lg, xl, full)",
					controls: "The corner radius scale.",
				},
				{
					name: "--ui-shadow-sm … --ui-shadow-xl",
					default: "from 0 1px 2px 0 rgb(0 0 0 / 0.05) to 0 20px 25px -5px rgb(0 0 0 / 0.1)",
					controls: "The elevation scale.",
				},
			],
		},
		{
			title: "Surfaces",
			lead: "Declared in `theme.css`, with dark values under `.dark` and `prefers-color-scheme: dark` and solid lines under `prefers-contrast: more`.",
			variables: [
				{
					name: "--ui-target-size",
					default: "1.5rem; 2.75rem on a coarse pointer",
					controls: "Smallest pointer target a small control grows to.",
				},
				{
					name: "--ui-shadow-ring",
					default: "a 1px ring at 6% black with a soft lift; 8% white in dark",
					controls: "Edge of cards, dialogs and floating surfaces.",
				},
				{
					name: "--ui-shadow-ring-hover",
					default: "the same ring a step stronger",
					controls: "The ring's hover state, for a surface that responds to the pointer.",
				},
				{
					name: "--ui-surface-raised",
					default: "white; a neutral 900–950 mix in dark",
					controls: 'Fill of a `variant="surface"` button.',
				},
				{
					name: "--ui-shadow-control",
					default: "a 1px drop with an inset highlight and ring",
					controls: 'Tactile edge of a `variant="surface"` button.',
				},
				{
					name: "--ui-shadow-surface, --ui-shadow-stage",
					default: "a ring with a small drop; a ring with a deep drop",
					controls: "Edges of raised cards and staged frames, which the landing parts read.",
				},
				{
					name: "--ui-image-outline",
					default: "rgb(0 0 0 / 0.1); rgb(255 255 255 / 0.1) in dark",
					controls: "Inset line that keeps an image's edge visible on a same-tone fill.",
				},
			],
		},
		{
			title: "Component tuning",
			lead: "Each falls back to its default in the component; set it on the element, an ancestor or `:root`.",
			variables: [
				{
					name: "--ui-button-radius",
					default: "var(--ui-radius-md); 9999px on an icon-only button",
					controls: "Corners of `Button` and `LinkButton`.",
				},
				{ name: "--ui-button-weight", default: "500", controls: "Weight of a button's label." },
				{
					name: "--ui-button-icon-size-sm, -md, -lg",
					default: "2rem, 2.5rem, 3rem",
					controls: "Edge of an icon-only button at each size.",
				},
				{
					name: "--ui-popover-offset",
					default: "0.5rem",
					controls: "Gap between a popover or hover card and its trigger.",
				},
				{
					name: "--ui-overlay-arrow-offset",
					default: "0.5rem",
					controls: "How far an `OverlayArrow` reaches past its surface.",
				},
				{
					name: "--ui-surface-padding",
					default: "0.25rem",
					controls: "Inner padding of floating surfaces; their inner radius follows it.",
				},
				{
					name: "--ui-hover-card-open-delay, --ui-hover-card-close-delay",
					default: "0.4s, 0.2s",
					controls: "How long a hover card waits to open and to close.",
				},
				{ name: "--ui-hover-card-z", default: "50", controls: "Stacking order of a hover card." },
				{
					name: "--ui-slider-thumb-size, --ui-slider-thumb-border-width",
					default: "1.25rem, 2px",
					controls: "A slider thumb's size and border.",
				},
				{
					name: "--ui-slider-track-thickness",
					default: "0.5rem",
					controls: "Thickness of a slider's track and fill.",
				},
				{
					name: "--ui-switch-track-inline-size, --ui-switch-track-block-size",
					default: "2.75rem, 1.5rem",
					controls: "Width and height of a `Switch`'s track.",
				},
				{
					name: "--ui-switch-thumb-size, --ui-switch-thumb-inset",
					default: "1.25rem, 0.125rem",
					controls: "A `Switch` thumb's size and its gap to the track's edge.",
				},
				{ name: "--ui-checkbox-size", default: "1.25rem", controls: "Edge of a Checkbox." },
				{
					name: "--ui-radio-size, --ui-radio-mark-size",
					default: "1.25rem, 0.625rem",
					controls: "A radio's circle and its checked dot.",
				},
				{
					name: "--ui-selection-indicator-size",
					default: "1rem",
					controls: "Edge of the check mark box in menus and lists.",
				},
				{
					name: "--ui-carousel-gap, --ui-carousel-slide-size, --ui-carousel-padding",
					default: "1rem, 18rem, 0px",
					controls: "A `Carousel`'s gap, slide size and track padding.",
				},
				{
					name: "--ui-spinner-icon-size-sm, -md, -lg",
					default: "1rem, 1.25rem, 1.75rem",
					controls: "A `Spinner`'s glyph at each size, also inside a pending Button.",
				},
				{
					name: "--ui-image-placeholder-size-sm, -md, -lg",
					default: "2rem, 2.5rem, 3rem",
					controls: "An `ImagePlaceholder`'s edge at each size; md is also an `Avatar`'s size.",
				},
				{
					name: "--ui-avatar-group-ring",
					default: "var(--ui-bg, Canvas)",
					controls: "Ring between overlapping avatars in Avatar.Group.",
				},
				{
					name: "--ui-item-gap, --ui-item-actions-gap",
					default: "0.75rem, 0.5rem",
					controls: "Gaps between an `Item`'s media and content, and between its actions.",
				},
				{
					name: "--ui-item-padding-block, --ui-item-padding-inline",
					default: "0.625rem, 0.75rem",
					controls: "An `Item`'s padding.",
				},
				{ name: "--ui-item-media-size", default: "2rem", controls: "Edge of an Item's media box." },
				{
					name: "--ui-sheet-size",
					default: "24rem, at most 90vw",
					controls: "Width of a Sheet.",
				},
				{
					name: "--ui-separator-thickness, --ui-separator-min-size",
					default: "1px, 1rem",
					controls: "A `Separator`'s thickness and a vertical one's shortest length.",
				},
				{
					name: "--ui-meter-track-block-size, --ui-progress-bar-block-size",
					default: "0.5rem, 0.5rem",
					controls: "Height of a `Meter`'s and a `ProgressBar`'s track.",
				},
				{
					name: "--ui-pagination-control-size",
					default: "2.25rem",
					controls: "Edge of each `Pagination` control.",
				},
				{
					name: "--ui-tag-remove-size",
					default: "1rem",
					controls: "Edge of a tag's remove button.",
				},
				{
					name: "--ui-navigation-menu-viewport-inline-size, -block-size",
					default: "auto",
					controls: "Size of `NavigationMenu`'s shared viewport, which transitions between panels.",
				},
				{
					name: "--ui-typeset-size, --ui-typeset-leading, --ui-typeset-flow",
					default: "set by Typeset's preset; docs is 1.125rem, 1.75, 1.25em",
					controls: "Body size, line height and space between blocks of rendered prose.",
				},
				{
					name: "--ui-aspect-ratio",
					default: "set by AspectRatio from ratio; 1",
					controls: "The box's aspect ratio.",
				},
			],
		},
		{
			title: "Animations",
			lead: "Each animation from `@sdxc/ui/animations` reads its options through these, so a variable overrides the option it names.",
			variables: [
				{
					name: "--ui-spin-duration, --ui-spin-easing, --ui-spin-fade-duration",
					default: "1s, linear, 150ms",
					controls: "One turn of `spin()`, its easing and its fade in and out.",
				},
				{
					name: "--ui-pulse-duration, --ui-pulse-easing, --ui-pulse-fade-duration",
					default: "1.6s, ease-in-out, 150ms",
					controls: "One breath of `pulse()`, its easing and its fade in and out.",
				},
				{
					name: "--ui-pulse-min-opacity, --ui-pulse-max-opacity",
					default: "0.5, 1",
					controls: "The dimmest and brightest points of `pulse()`.",
				},
				{
					name: "--ui-shimmer-duration, --ui-shimmer-easing, --ui-shimmer-band-size, --ui-shimmer-fade-duration",
					default: "1.6s, ease-in-out, 50%, 150ms",
					controls: "One sweep of `shimmer()`, its easing, its band's width and its fade.",
				},
				{
					name: "--ui-text-shimmer-duration, -easing, -band-size, -angle",
					default: "2s, linear, 30%, 90deg",
					controls: "One sweep of `textShimmer()` through the glyphs, and its band.",
				},
				{
					name: "--ui-text-shimmer-color, --ui-text-shimmer-fade-duration",
					default: "currentColor, 150ms",
					controls: "The band's peak color and the shimmer's fade.",
				},
				{
					name: "--ui-scroll-shadow",
					default: "0 4px 12px -4px rgb(0 0 0 / 0.18)",
					controls: "Shadow `scrollShadow()` ramps in under a sticky header.",
				},
			],
		},
		{
			title: "Set by the components",
			lead: "Written by a component from its props or by a mixin, and read back by its own parts. Leave them unset.",
			variables: [
				{
					name: "--ui-tab-indicator-inline-start, -inline-size, -block-start, -block-size, -opacity",
					default: "set by Tabs.List from activeIndex and tabSize",
					controls: "Where the active tab's indicator sits and whether it shows.",
				},
				{
					name: "--ui-slider-fill",
					default: "set by Slider.Track from value",
					controls: "How much of the track is filled.",
				},
				{
					name: "--ui-drawer-enter-offset, --ui-drawer-exit-offset",
					default: "set by Drawer from placement",
					controls: "Where a drawer slides in from and out to.",
				},
				{
					name: "--ui-sheet-enter-offset, --ui-sheet-exit-offset",
					default: "set by Sheet from side",
					controls: "Where a sheet slides in from and out to.",
				},
				{
					name: "--ui-box-shadow-ring",
					default: "var(--ui-shadow-ring)",
					controls: "The ring slot of a surface's composite shadow.",
				},
				{
					name: "--ui-view-reveal-translate, --ui-scroll-fade-direction",
					default: "set by viewReveal() and scrollFade()",
					controls: "A reveal's starting offset and a scroll fade's direction, mirrored in RTL.",
				},
			],
		},
	],
};

export default COMPONENTS;
