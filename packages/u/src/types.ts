/**
 * Extensible token-name interfaces. Each one is empty of behavior — its only
 * job is to hold names as keys so an app can add its own through declaration
 * merging:
 *
 * @example
 * declare module "@pkg/u" {
 *   interface ColorPalettes {
 *     info: true;
 *   }
 * }
 *
 * No runtime registry backs any of these. A utility that accepts, say, a
 * {@link RadiusName} resolves straight to `var(--ui-radius-{name})` from the
 * typed string — adding a name here only changes what TypeScript accepts,
 * and the matching CSS variable is what makes it actually resolve.
 *
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
 * `u.accent()`, and `u.surface()`: a raw palette reference
 * (`"color.brand.600"`), a semantic tone with an explicit property suffix
 * (`"brand.tint"`, `"brand.muted"`, `"brand.strong"`, ...), or a bare
 * semantic tone name that resolves to that utility's own default property.
 */
export type ColorValue =
	| `color.${ColorPaletteName}.${PaletteShade}`
	| `${SemanticToneName}.${string}`
	| SemanticToneName
	| "inherit"
	| "currentColor"
	| "transparent";
