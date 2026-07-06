/**
 * The theme model and CSS generator: the {@link ThemeSettings} knobs, their defaults,
 * and {@link renderThemeStyle}, which derives an OKLCH palette and emits the `:root`
 * variables the components consume — so the palette is a runtime artifact of settings
 * rather than a shipped stylesheet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { FontPreset } from "./presets";

import {
	FONT_SIZE_SCALE,
	FONT_STACKS,
	LIGHTNESS_LADDER,
	RADIUS_SCALE,
	SPACING_SCALE,
} from "./presets";

/** The nine theme knobs edited in `/cms/appearance`, stored in `settings.theme`. */
export interface ThemeSettings {
	/** Accent color (hex); drives the accent palette. */
	accent: string;
	/** Page background color (hex). */
	background: string;
	/** Body text color (hex). */
	foreground: string;
	radius: keyof typeof RADIUS_SCALE;
	spacing: keyof typeof SPACING_SCALE;
	fontHeading: FontPreset;
	fontBody: FontPreset;
	fontSize: keyof typeof FONT_SIZE_SCALE;
	/** Max line length for prose (e.g. "65ch"). */
	measure: string;
}

/** Engine defaults applied when a knob is unset. */
export const DEFAULT_THEME: ThemeSettings = {
	accent: "#2563eb",
	background: "#ffffff",
	foreground: "#111827",
	radius: "soft",
	spacing: "comfortable",
	fontHeading: "sans",
	fontBody: "sans",
	fontSize: "medium",
	measure: "65ch",
};

/** A color in the OKLCH space. */
interface Oklch {
	l: number; // 0..1
	c: number; // chroma
	h: number; // degrees
}

/**
 * Merges a partial theme over the engine defaults, filling any unset knob.
 * @param theme - Partial theme settings, or undefined.
 * @returns A complete {@link ThemeSettings}.
 */
export function resolveTheme(theme: Partial<ThemeSettings> | undefined): ThemeSettings {
	return { ...DEFAULT_THEME, ...theme };
}

/**
 * Renders a complete `:root { … }` style block from theme settings. Colors are
 * derived to an OKLCH lightness ladder (hue/chroma held from the inputs) and
 * mapped onto the `--ui-*` semantic tokens the components consume, so no static
 * stylesheet ships — the palette is a runtime artifact of settings.
 * @param settings - Partial or complete theme settings.
 * @returns CSS text for a single `:root` rule.
 */
export function renderThemeStyle(settings: Partial<ThemeSettings> | undefined): string {
	let theme = resolveTheme(settings);
	let accent = hexToOklch(theme.accent);
	let background = hexToOklch(theme.background);
	let foreground = hexToOklch(theme.foreground);

	// Neutral hue/chroma track the background (very low chroma) so the neutral
	// ramp harmonizes with the chosen background instead of being pure gray.
	let neutralHue = background.h;
	let neutralChroma = Math.min(background.c, 0.02);

	let lines: string[] = [];
	lines.push(`--blog-accent: ${oklch(accent)};`);
	lines.push(`--blog-bg: ${oklch(background)};`);
	lines.push(`--blog-fg: ${oklch(foreground)};`);
	lines.push(`--blog-radius: ${RADIUS_SCALE[theme.radius]};`);
	lines.push(`--blog-spacing: ${SPACING_SCALE[theme.spacing]};`);
	lines.push(`--blog-font-heading: ${FONT_STACKS[theme.fontHeading]};`);
	lines.push(`--blog-font-body: ${FONT_STACKS[theme.fontBody]};`);
	lines.push(`--blog-font-size: ${FONT_SIZE_SCALE[theme.fontSize]};`);
	lines.push(`--blog-measure: ${theme.measure};`);

	for (let { stop, lightness } of LIGHTNESS_LADDER) {
		lines.push(
			`--color-accent-${stop}: ${oklch({ l: lightness / 100, c: accent.c, h: accent.h })};`,
		);
		lines.push(
			`--color-neutral-${stop}: ${oklch({ l: lightness / 100, c: neutralChroma, h: neutralHue })};`,
		);
	}

	// Semantic tokens the components consume (kept on --ui-*).
	lines.push(`--ui-bg: var(--blog-bg);`);
	lines.push(`--ui-fg: var(--blog-fg);`);
	lines.push(`--ui-muted: var(--color-neutral-500);`);
	lines.push(`--ui-border: var(--color-neutral-200);`);
	lines.push(`--ui-surface: var(--color-neutral-50);`);
	lines.push(`--ui-accent: var(--blog-accent);`);
	lines.push(`--ui-accent-fg: var(--color-accent-50);`);
	lines.push(`--ui-accent-hover: var(--color-accent-600);`);
	lines.push(`--ui-radius: var(--blog-radius);`);
	lines.push(`--ui-space: var(--blog-spacing);`);

	return `:root {\n\t${lines.join("\n\t")}\n}`;
}

/**
 * Formats an OKLCH color as a CSS `oklch()` value, clamping/normalizing components.
 * @param color - The OKLCH color to format.
 * @returns A CSS `oklch(L% C H)` string.
 */
function oklch({ l, c, h }: Oklch): string {
	let lp = round(clamp(l, 0, 1) * 100, 2);
	let cp = round(Math.max(c, 0), 4);
	let hp = round(((h % 360) + 360) % 360, 2);
	return `oklch(${lp}% ${cp} ${hp})`;
}

/**
 * Converts a `#rgb`/`#rrggbb` hex color to OKLCH (via linear sRGB and OKLab), falling
 * back to a neutral gray on malformed input so rendering never throws on bad settings.
 * @param hex - The hex color string.
 * @returns The equivalent OKLCH color.
 */
export function hexToOklch(hex: string): Oklch {
	let rgb = parseHex(hex);
	if (!rgb) return { l: 0.5, c: 0, h: 0 };
	let [r, g, b] = rgb.map(srgbToLinear) as [number, number, number];

	// linear sRGB -> OKLab (Björn Ottosson's matrices)
	let l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
	let m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
	let s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

	let l_ = Math.cbrt(l);
	let m_ = Math.cbrt(m);
	let s_ = Math.cbrt(s);

	let okl = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
	let oka = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
	let okb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

	let chroma = Math.sqrt(oka * oka + okb * okb);
	let hue = (Math.atan2(okb, oka) * 180) / Math.PI;
	return { l: okl, c: chroma, h: (hue + 360) % 360 };
}

function parseHex(hex: string): [number, number, number] | null {
	let value = hex.trim().replace(/^#/, "");
	if (value.length === 3) {
		value = value
			.split("")
			.map((ch) => ch + ch)
			.join("");
	}
	if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
	let r = parseInt(value.slice(0, 2), 16) / 255;
	let g = parseInt(value.slice(2, 4), 16) / 255;
	let b = parseInt(value.slice(4, 6), 16) / 255;
	return [r, g, b];
}

function srgbToLinear(channel: number): number {
	return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function round(value: number, digits: number): number {
	let factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}
