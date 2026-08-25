/**
 * The application's design tokens expressed as `remix/ui` mixins: five OKLCH
 * color ramps, the Inter-first font stack, and the document surface that
 * follows the viewer's color scheme. Views compose these instead of shipping a
 * stylesheet, so the palette travels with the markup that uses it.
 *
 * This module is the single exception to the rule that mixins are written
 * inline at their use site — a shared token layer only works if there is
 * exactly one definition of it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { css } from "remix/ui";

/**
 * Every palette step as `--ui-color-{name}-{step}` custom properties and the
 * `--ui-font-sans` stack, applied to `<html>` so the whole tree inherits them.
 * Chroma peaks mid-ramp so both extremes stay usable as plain backgrounds.
 *
 * @example
 * <html mix={[THEME, DOCUMENT]}>
 */
export const THEME = css({
	"--ui-color-neutral-50": "oklch(0.985 0 0)",
	"--ui-color-neutral-100": "oklch(0.97 0 0)",
	"--ui-color-neutral-200": "oklch(0.922 0 0)",
	"--ui-color-neutral-300": "oklch(0.87 0 0)",
	"--ui-color-neutral-400": "oklch(0.708 0 0)",
	"--ui-color-neutral-500": "oklch(0.556 0 0)",
	"--ui-color-neutral-600": "oklch(0.439 0 0)",
	"--ui-color-neutral-700": "oklch(0.371 0 0)",
	"--ui-color-neutral-800": "oklch(0.269 0 0)",
	"--ui-color-neutral-900": "oklch(0.205 0 0)",
	"--ui-color-neutral-950": "oklch(0.145 0 0)",

	"--ui-color-brand-50": "oklch(0.97 0.02 250)",
	"--ui-color-brand-100": "oklch(0.94 0.04 250)",
	"--ui-color-brand-200": "oklch(0.88 0.08 250)",
	"--ui-color-brand-300": "oklch(0.8 0.12 250)",
	"--ui-color-brand-400": "oklch(0.7 0.16 250)",
	"--ui-color-brand-500": "oklch(0.6 0.18 250)",
	"--ui-color-brand-600": "oklch(0.52 0.18 250)",
	"--ui-color-brand-700": "oklch(0.44 0.16 250)",
	"--ui-color-brand-800": "oklch(0.36 0.14 250)",
	"--ui-color-brand-900": "oklch(0.28 0.1 250)",
	"--ui-color-brand-950": "oklch(0.2 0.08 250)",

	"--ui-color-danger-50": "oklch(0.97 0.02 25)",
	"--ui-color-danger-100": "oklch(0.94 0.04 25)",
	"--ui-color-danger-200": "oklch(0.88 0.1 25)",
	"--ui-color-danger-300": "oklch(0.8 0.15 25)",
	"--ui-color-danger-400": "oklch(0.7 0.18 25)",
	"--ui-color-danger-500": "oklch(0.6 0.2 25)",
	"--ui-color-danger-600": "oklch(0.52 0.2 25)",
	"--ui-color-danger-700": "oklch(0.44 0.18 25)",
	"--ui-color-danger-800": "oklch(0.36 0.15 25)",
	"--ui-color-danger-900": "oklch(0.28 0.12 25)",
	"--ui-color-danger-950": "oklch(0.2 0.08 25)",

	"--ui-color-warning-50": "oklch(0.97 0.02 85)",
	"--ui-color-warning-100": "oklch(0.94 0.06 85)",
	"--ui-color-warning-200": "oklch(0.88 0.12 85)",
	"--ui-color-warning-300": "oklch(0.8 0.16 85)",
	"--ui-color-warning-400": "oklch(0.7 0.18 85)",
	"--ui-color-warning-500": "oklch(0.6 0.18 85)",
	"--ui-color-warning-600": "oklch(0.52 0.18 85)",
	"--ui-color-warning-700": "oklch(0.44 0.16 85)",
	"--ui-color-warning-800": "oklch(0.36 0.14 85)",
	"--ui-color-warning-900": "oklch(0.28 0.1 85)",
	"--ui-color-warning-950": "oklch(0.2 0.08 85)",

	"--ui-color-success-50": "oklch(0.98 0.02 155)",
	"--ui-color-success-100": "oklch(0.96 0.05 155)",
	"--ui-color-success-200": "oklch(0.92 0.09 155)",
	"--ui-color-success-300": "oklch(0.86 0.15 155)",
	"--ui-color-success-400": "oklch(0.78 0.2 155)",
	"--ui-color-success-500": "oklch(0.7 0.2 155)",
	"--ui-color-success-600": "oklch(0.62 0.18 155)",
	"--ui-color-success-700": "oklch(0.52 0.14 155)",
	"--ui-color-success-800": "oklch(0.44 0.11 155)",
	"--ui-color-success-900": "oklch(0.38 0.09 155)",
	"--ui-color-success-950": "oklch(0.26 0.06 155)",

	"--ui-font-sans":
		'"Inter", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
});

/**
 * The page surface: white by default, the darkest neutral in a dark scheme,
 * with `color-scheme: dark` so native controls and scrollbars match. Apply to
 * both `<html>` and `<body>` so a short page's canvas stays dark beneath it.
 *
 * @example
 * <body mix={DOCUMENT}>
 */
export const DOCUMENT = css({
	backgroundColor: "#fff",
	fontFamily: "var(--ui-font-sans)",

	"@media (prefers-color-scheme: dark)": {
		colorScheme: "dark",
		backgroundColor: "var(--ui-color-neutral-950)",
	},
});
