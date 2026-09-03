/**
 * Token-name interfaces an app extends through declaration merging. The names
 * live purely in the type system: a utility turns an accepted name straight
 * into `var(--ui-radius-{name})`, so the matching CSS variable is what makes
 * it resolve.
 *
 * @example
 * declare module "@sdxc/u" { interface ColorPalettes { info: true } }
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Raw palette scale names, each exposing `50`, `100`-`900` in steps of `100`, and `950`. */
export interface ColorPalettes {
	neutral: true;
	brand: true;
	success: true;
	warning: true;
	danger: true;
}

/** Semantic tone names, each mapped to `bg-tint`, `bg-solid`, `fg`, `fg-muted`, `fg-emphasis`, `fg-on-solid`, `border`, `border-strong`, and `ring`. */
export interface SemanticTones {
	neutral: true;
	brand: true;
	success: true;
	warning: true;
	danger: true;
}

/** Named corner-radius scale, read by `u.rounded()`, `u.squircle()`, and any utility that shares the radius scale. */
export interface Radii {
	none: true;
	sm: true;
	md: true;
	lg: true;
	xl: true;
	full: true;
}

/** Named font-size scale, read by `u.text()` and `u.type()`. */
export interface TextSizes {
	xs: true;
	sm: true;
	base: true;
	lg: true;
	xl: true;
	"2xl": true;
	"3xl": true;
	"4xl": true;
	"5xl": true;
	"6xl": true;
	"7xl": true;
	"8xl": true;
	"9xl": true;
}

/** Named font-family stacks, read by `u.font()`. */
export interface FontFamilies {
	sans: true;
	serif: true;
	mono: true;
}

/** Named container-query breakpoints, read by `u.at()`. */
export interface Containers {
	xs: true;
	sm: true;
	md: true;
	lg: true;
	xl: true;
	"2xl": true;
}

/** Named box-shadow scale, read by `u.shadow()`. */
export interface Shadows {
	sm: true;
	base: true;
	md: true;
	lg: true;
	xl: true;
}

/** Named blur scale, read by `u.blur()`, `u.backdropBlur()`, and `u.translucent()`. */
export interface Blurs {
	sm: true;
	md: true;
	lg: true;
}

export type ColorPaletteName = keyof ColorPalettes;
export type SemanticToneName = keyof SemanticTones;
export type RadiusName = keyof Radii;
export type TextSizeName = keyof TextSizes;
export type FontFamilyName = keyof FontFamilies;
export type ContainerName = keyof Containers;
export type ShadowName = keyof Shadows;
export type BlurName = keyof Blurs;

/** A palette shade: `50`, then `100`-`900` in steps of `100`, then `950`. */
export type PaletteShade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

/**
 * Accepted color input across `u.bg()`, `u.fg()`, `u.border()`, `u.ring()`,
 * `u.accent()`, and `u.surface()`: a raw palette reference, a tone with an
 * explicit property suffix, or a bare tone taking the utility's own default.
 */
export type ColorValue =
	| `color.${ColorPaletteName}.${PaletteShade}`
	| `${SemanticToneName}.${string}`
	| SemanticToneName
	| "inherit"
	| "currentColor"
	| "transparent";
