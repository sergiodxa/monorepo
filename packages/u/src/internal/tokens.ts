/**
 * Pure token resolvers: given a typed token name, return the CSS string a
 * utility should place in a declaration. None of these call `css()`, build a
 * mixin, or register anything at runtime — they only stringify. Component
 * packages needing the same resolution without a mixin can import them
 * directly (`import { spacing } from "@pkg/u"`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type {
	BlurName,
	ColorValue,
	ContainerName,
	FontFamilyName,
	RadiusName,
	ShadowName,
	TextSizeName,
} from "../types";

import { var as varUtility } from "../general/var";

/** Friendly suffix a call site writes, mapped to the CSS variable's actual property segment. */
const COLOR_PROPERTY_ALIASES: Record<string, string> = {
	tint: "bg-tint",
	solid: "bg-solid",
	muted: "fg-muted",
	emphasis: "fg-emphasis",
	onSolid: "fg-on-solid",
	strong: "border-strong",
};

/**
 * Resolves a {@link ColorValue} to a `var(...)` reference. A raw palette
 * value (`"color.brand.600"`) resolves to `var(--ui-color-brand-600)`. A
 * semantic tone resolves to `var(--ui-{tone}-{property})`, where `property`
 * is either the explicit suffix on `value` (aliased through
 * {@link COLOR_PROPERTY_ALIASES} when it's a friendly short form) or
 * `defaultProperty` when `value` names a bare tone.
 *
 * @example color("brand.tint") // "var(--ui-brand-bg-tint)"
 * @example color("color.neutral.50") // "var(--ui-color-neutral-50)"
 * @example color("brand", "border") // "var(--ui-brand-border)"
 * @example color("color-mix(in oklab, red 50%, blue)") // "color-mix(in oklab, red 50%, blue)"
 */
export function color(value: ColorValue | (string & {}), defaultProperty?: string): string {
	if (value === "transparent") return "transparent";
	if (value === "inherit") return "inherit";
	if (value.toLowerCase() === "currentcolor") return "currentColor";

	// An already-fully-formed CSS color value — e.g. the output of
	// `u.colorMix(...)`, or a raw `var(...)` reference — passes through
	// unchanged instead of being mistaken for a "tone.property" token. Tone
	// names and their suffixes are always simple identifiers with no
	// parentheses, so this check is unambiguous.
	if (value.includes("(")) return value;

	if (value.startsWith("color.")) {
		let [, name, shade] = value.split(".");
		return varUtility(`ui-color-${name}-${shade}`);
	}
	let [tone, suffix = defaultProperty] = value.split(".");
	if (!suffix) {
		throw new Error(`@pkg/u: color("${value}") has no property and no default was given`);
	}
	let property = COLOR_PROPERTY_ALIASES[suffix] ?? suffix;
	return varUtility(`ui-${tone}-${property}`);
}

/** Raw CSS length units accepted alongside the numeric spacing scale. */
const LENGTH_PATTERN =
	/^-?\d+(\.\d+)?(px|ch|em|rem|%|vw|vh|dvw|dvh|vi|vb|svw|svh|lvw|lvh|cqw|cqh|cqmin|cqmax)$/;

export type SpacingValue = number | "auto" | (string & {});

/**
 * Resolves one spacing value to a CSS length. A number resolves against the
 * spacing scale (`calc(var(--ui-spacing, 0.25rem) * n)`); `"auto"` passes
 * through for margin's auto-centering; any other string is assumed to
 * already be a valid CSS length (`"13px"`, `"60ch"`, `"100dvh"`) and passes
 * through unchanged.
 *
 * @example spacing(4) // "calc(var(--ui-spacing, 0.25rem) * 4)"
 * @example spacing("auto") // "auto"
 * @example spacing("13px") // "13px"
 */
export function spacing(value: SpacingValue): string {
	if (typeof value === "number") return `calc(var(--ui-spacing, 0.25rem) * ${value})`;
	return value;
}

export type SizeValue = SpacingValue | "full";

/**
 * Resolves one sizing value to a CSS length, same as {@link spacing} plus
 * `"full"` resolving to `100%` — the keyword `u.is()`/`u.bs()` and their
 * `min`/`max` variants use for "fill the available space".
 *
 * @example boxLength("full") // "100%"
 * @example boxLength(4) // "calc(var(--ui-spacing, 0.25rem) * 4)"
 */
export function boxLength(value: SizeValue): string {
	if (value === "full") return "100%";
	return spacing(value);
}

/** True when `value` is a raw CSS length string rather than a spacing-scale number. */
export function isLength(value: unknown): value is string {
	return typeof value === "string" && LENGTH_PATTERN.test(value);
}

const RADIUS_FALLBACKS: Record<RadiusName, string> = {
	none: "0px",
	sm: "0.25rem",
	md: "0.375rem",
	lg: "0.5rem",
	xl: "0.75rem",
	full: "9999px",
};

/**
 * Resolves a {@link RadiusName} to `var(--ui-radius-{name}, fallback)`, with
 * a sensible fallback baked in so the radius scale works before an app ever
 * defines the variable. A name that isn't a recognized scale step but is
 * already a raw CSS length (`"3px"`, `"0.125rem"`) passes through literally
 * instead of being treated as an app-extensible token name — only a
 * bare-word name (e.g. an app's own `"hero"` step) resolves through the
 * `var(...)` indirection.
 *
 * @example radius("lg") // "var(--ui-radius-lg, 0.5rem)"
 * @example radius("3px") // "3px"
 */
export function radius(name: RadiusName | (string & {})): string {
	if (isLength(name)) return name;
	let fallback = RADIUS_FALLBACKS[name as RadiusName] ?? "0px";
	return varUtility(`ui-radius-${name}`, fallback);
}

const FONT_FALLBACKS: Record<FontFamilyName, string> = {
	sans: "ui-sans-serif, system-ui, sans-serif",
	serif: "ui-serif, Georgia, serif",
	mono: "ui-monospace, SFMono-Regular, monospace",
};

/**
 * Resolves a {@link FontFamilyName} to `var(--ui-font-{name}, fallback)`.
 *
 * @example font("serif") // 'var(--ui-font-serif, ui-serif, Georgia, serif)'
 */
export function font(name: FontFamilyName | (string & {})): string {
	let fallback = FONT_FALLBACKS[name as FontFamilyName] ?? "sans-serif";
	return varUtility(`ui-font-${name}`, fallback);
}

const TEXT_FALLBACKS: Record<TextSizeName, string> = {
	xs: "0.75rem",
	sm: "0.875rem",
	base: "1rem",
	lg: "1.125rem",
	xl: "1.25rem",
	"2xl": "1.5rem",
	"3xl": "1.875rem",
	"4xl": "2.25rem",
	"5xl": "3rem",
	"6xl": "3.75rem",
	"7xl": "4.5rem",
	"8xl": "6rem",
	"9xl": "8rem",
};

/**
 * Resolves a {@link TextSizeName} to `var(--ui-text-{name}, fallback)`. A
 * name that isn't a recognized scale step but is already a raw CSS length
 * passes through literally — see {@link radius} for the same rule.
 *
 * @example text("lg") // "var(--ui-text-lg, 1.125rem)"
 * @example text("0.9375rem") // "0.9375rem"
 */
export function text(name: TextSizeName | (string & {})): string {
	if (isLength(name)) return name;
	let fallback = TEXT_FALLBACKS[name as TextSizeName] ?? "1rem";
	return varUtility(`ui-text-${name}`, fallback);
}

const CONTAINER_FALLBACKS: Record<ContainerName, string> = {
	xs: "20rem",
	sm: "24rem",
	md: "36rem",
	lg: "48rem",
	xl: "64rem",
	"2xl": "80rem",
};

/**
 * Resolves a {@link ContainerName} to `var(--ui-container-{name}, fallback)`,
 * the container scale as a *property value*, where the indirection is what
 * makes the scale themable. A literal length that isn't a recognized scale
 * step (a one-off breakpoint like `"40rem"`) passes through unchanged
 * instead of being treated as an app-extensible token name — see
 * {@link radius} for the same rule.
 *
 * At-rule conditions can't read custom properties at all, so query builders
 * resolve the same names through {@link containerLength} instead.
 *
 * @example container("md") // "var(--ui-container-md, 36rem)"
 * @example container("40rem") // "40rem"
 */
export function container(name: ContainerName | (string & {})): string {
	if (isLength(name)) return name;
	let fallback = CONTAINER_FALLBACKS[name as ContainerName] ?? "36rem";
	return varUtility(`ui-container-${name}`, fallback);
}

/**
 * The at-rule counterpart to {@link container}: resolves a
 * {@link ContainerName} to its literal length, never a `var()` reference. A
 * literal length passes through unchanged, exactly as in {@link container}.
 *
 * `@container`/`@media` *conditions* are evaluated before custom properties
 * are substituted, so a `var()` inside one makes the whole at-rule inert —
 * it parses, it is emitted, and it never matches at any size. Only the
 * declarations *inside* an at-rule can read custom properties, which is why
 * {@link container} still resolves to `var(--ui-container-*, fallback)` for
 * property values, where the indirection is what makes the scale themable.
 *
 * @example containerLength("md") // "36rem"
 * @example containerLength("40rem") // "40rem"
 */
export function containerLength(name: ContainerName | (string & {})): string {
	if (isLength(name)) return name;
	return CONTAINER_FALLBACKS[name as ContainerName] ?? "36rem";
}

const SHADOW_FALLBACKS: Record<ShadowName, string> = {
	sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
	base: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
	md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
	lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
	xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
};

/**
 * Resolves a {@link ShadowName} to `var(--ui-shadow-{name}, fallback)`. A
 * literal shadow value can't be reliably told apart from an app-extended
 * token name (both are arbitrary strings with no shape in common with a
 * length), so unlike {@link radius}/{@link text}/{@link container} this
 * resolver has no literal-passthrough escape hatch — a genuinely one-off
 * shadow should compose through `u.raw({ boxShadow: "..." })` instead.
 *
 * @example shadow("md") // 'var(--ui-shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1))'
 */
export function shadow(name: ShadowName | (string & {})): string {
	let fallback = SHADOW_FALLBACKS[name as ShadowName] ?? SHADOW_FALLBACKS.md;
	return varUtility(`ui-shadow-${name}`, fallback);
}

const BLUR_FALLBACKS: Record<BlurName, string> = {
	sm: "4px",
	md: "12px",
	lg: "24px",
};

/**
 * Resolves a {@link BlurName} to `var(--ui-blur-{name}, fallback)`. A literal
 * length that isn't a recognized scale step passes through unchanged — see
 * {@link radius} for the same rule.
 *
 * @example blur("sm") // "var(--ui-blur-sm, 4px)"
 * @example blur("8px") // "8px"
 */
export function blur(name: BlurName | (string & {})): string {
	if (isLength(name)) return name;
	let fallback = BLUR_FALLBACKS[name as BlurName] ?? BLUR_FALLBACKS.md;
	return varUtility(`ui-blur-${name}`, fallback);
}
