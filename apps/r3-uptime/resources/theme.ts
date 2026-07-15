/**
 * Shared color and font tokens for the whole UI. Every color scale is `oklch`;
 * `neutral` is the achromatic gray used for text/borders/backgrounds, `primary` is
 * the brand green used for links and primary actions, `danger` is the red used for
 * destructive actions, and `status` covers the four monitor/badge tones. `fontMono`
 * is the document's default body font, and `fontSans` is the self-hosted display
 * font the marketing chrome opts into.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The document's default font, rendered on `<body>` unless a layout opts into
 * {@link fontSans}: the platform's own UI monospace font, with no self-hosted file.
 */
export const fontMono =
	'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

/**
 * Self-hosted display font the marketing site opts into (nav, brand mark,
 * headings), with system sans-serif fallbacks. The `/docs` chrome keeps the
 * document's {@link fontMono} default instead. Its `@font-face` rule is declared
 * once in `DocumentLayout`.
 */
export const fontSans =
	'"Mona Sans", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

export const neutral = {
	50: "oklch(0.98 0.005 145)",
	100: "oklch(0.96 0.005 145)",
	200: "oklch(0.91 0.008 145)",
	300: "oklch(0.83 0.01 145)",
	400: "oklch(0.73 0.01 145)",
	500: "oklch(0.62 0.01 145)",
	700: "oklch(0.42 0.008 145)",
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
	950: "oklch(0.16 0.004 145)",
} as const;

export const primary = {
	100: "oklch(0.92 0.08 142)",
	400: "oklch(0.78 0.16 142)",
	600: "oklch(0.6 0.16 142)",
} as const;

export const danger = {
	600: "oklch(0.58 0.18 25)",
	700: "oklch(0.48 0.16 25)",
} as const;

export const status = {
	up: { light: "oklch(0.62 0.18 155)", dark: "oklch(0.78 0.2 155)" },
	degraded: { light: "oklch(0.62 0.16 85)", dark: "oklch(0.8 0.18 85)" },
	down: { light: "oklch(0.58 0.18 25)", dark: "oklch(0.78 0.18 25)" },
	neutral: { light: neutral[500], dark: neutral[400] },
} as const;
