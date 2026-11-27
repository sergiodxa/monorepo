/**
 * The package entrypoint: the immutable `Color` value, the errors its fallible operations
 * report, and the plain shapes it converts to and takes options as.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { ColorFormat, Hsl, Oklab, Oklch, OklchChanges, Rgb } from "./color.js";
export type { ContrastAlgorithm, WcagContrast } from "./contrast.js";
export type { HueInterpolation, InterpolationOptions, InterpolationSpace } from "./interpolate.js";

export { Color } from "./color.js";
export { ColorParseError } from "./color-parse-error.js";
export { ContrastUnreachableError } from "./contrast-unreachable-error.js";
