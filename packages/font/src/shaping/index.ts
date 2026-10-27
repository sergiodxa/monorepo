/**
 * The shaping entry point, `@sdxc/font/shaping`: OpenType layout for complex text, with the
 * Unicode property tables it needs. It lives apart from `@sdxc/font` so a Worker that only
 * measures Latin text never loads the layout processors or the Unicode data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export { featureParams } from "./feature-params.js";
export type {
	CharacterVariantParams,
	FeatureParams,
	SizeParams,
	StylisticSetParams,
} from "./feature-params.js";
export type { UserFeatures } from "./plan.js";
export { availableFeatures, shape } from "./shape.js";
export type { ShapedGlyph, ShapedText, ShapeOptions } from "./shape.js";
export { UNICODE_VERSION } from "./unicode/unicode.data.js";
