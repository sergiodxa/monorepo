/**
 * Public entry point for the font package: `parseFont` reads a TrueType file into a
 * `Font` that answers metrics, kerning, outlines and line layout, and `FontError` explains
 * a file it cannot read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export { FontCollection, parseFontCollection } from "./collection.js";
export { Font } from "./font.js";
export { FontError } from "./font-error.js";
export { parseFont } from "./parse-font.js";
export { toSVGPath } from "./svg-path.js";
