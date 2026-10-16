/**
 * The package entry point: `encode` writes a `PNG.Image` as PNG bytes and `decode` reads any
 * valid PNG back into one, both on the platform's compression streams so a Worker renders
 * images with no WebAssembly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { PNG } from "./png.js";

export { decode } from "./decode.js";
export { encode } from "./encode.js";
export { PNGError } from "./png.js";
