/**
 * `@sdxc/font/color`: color glyphs. Layered `COLR` glyphs with their `CPAL` palettes, and
 * `sbix` bitmap glyphs, read from a `Font` on request so a font that draws plain text pays
 * nothing for them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { ColorLayer, ColorLayersOptions } from "./colr.js";
export type { Color, Palette } from "./cpal.js";
export type { Bitmap, BitmapType, Strike } from "./sbix.js";

export { colorLayers } from "./colr.js";
export { paletteEntryLabels, palettes } from "./cpal.js";
export { bitmap, strikes } from "./sbix.js";
