/**
 * The package entry point: `Canvas` draws antialiased paths, gradients, layers, masks and
 * text into a pixel buffer and encodes it as PNG, with no WebAssembly, so a Worker can
 * render an image on demand. Nothing runs at import time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { Raster } from "./types.js";

export { Canvas } from "./canvas.js";
export { color, TRANSPARENT, withAlpha } from "./color.js";
export { linearGradient, radialGradient } from "./paint.js";
export { Path } from "./path.js";
