/**
 * Fixed lookup tables backing the theme knobs: system font stacks, radius/spacing/
 * font-size scales, and the OKLCH lightness ladder used to generate palette stops.
 * Kept data-only so {@link renderThemeStyle} can map settings onto CSS tokens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Named typography preset mapping to a system font stack. */
export type FontPreset = "sans" | "serif" | "mono" | "slab";

/** System font stacks for each typography preset, already available on the device. */
export const FONT_STACKS: Record<FontPreset, string> = {
	sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
	serif: "Iowan Old Style, Apple Garamond, Baskerville, 'Times New Roman', Georgia, serif",
	mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
	slab: "Rockwell, 'Rockwell Nova', 'Roboto Slab', 'DejaVu Serif', 'Sitka Small', serif",
};

/** Border-radius scale (one radius knob). */
export const RADIUS_SCALE = {
	square: "0",
	soft: "0.375rem",
	rounded: "0.75rem",
	round: "1.25rem",
} as const;

/** Spacing scale (one spacing knob; components multiply this). */
export const SPACING_SCALE = {
	compact: "0.75rem",
	comfortable: "1rem",
	spacious: "1.25rem",
} as const;

/** Base font-size scale. */
export const FONT_SIZE_SCALE = {
	small: "0.9375rem",
	medium: "1rem",
	large: "1.125rem",
} as const;

/** The lightness ladder (0-100) for generated palette stops 50..950. */
export const LIGHTNESS_LADDER: Array<{ stop: number; lightness: number }> = [
	{ stop: 50, lightness: 97 },
	{ stop: 100, lightness: 94 },
	{ stop: 200, lightness: 87 },
	{ stop: 300, lightness: 78 },
	{ stop: 400, lightness: 68 },
	{ stop: 500, lightness: 58 },
	{ stop: 600, lightness: 49 },
	{ stop: 700, lightness: 40 },
	{ stop: 800, lightness: 32 },
	{ stop: 900, lightness: 24 },
	{ stop: 950, lightness: 16 },
];
