/**
 * The package entry point: `encodeQr` turns text or bytes into a QR symbol, and `svgPath`
 * turns a symbol into SVG attribute data. It depends only on `@sdxc/result` and runs
 * wherever `TextEncoder` does; the `remix/component` renderer lives in `@sdxc/qr/component`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { QrLevel, QrOptions, QrSymbol } from "./encode.js";

export { encodeQr, QrError } from "./encode.js";

export type { SvgPath, SvgPathOptions } from "./svg-path.js";

export { svgPath } from "./svg-path.js";
