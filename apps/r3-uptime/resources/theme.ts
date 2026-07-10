/**
 * Shared color tokens for the whole UI. Every scale is `oklch`; `neutral` is the
 * achromatic gray used for text/borders/backgrounds, `primary` is the brand green
 * used for links and primary actions, `danger` is the red used for destructive
 * actions, and `status` covers the four monitor/badge tones.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
