/**
 * The package entry point: `QR.encode` turns text or bytes into a QR symbol, and
 * its `toSVGPath` method turns the symbol into SVG attribute data. It depends only on `@sdxc/result` and runs
 * wherever `TextEncoder` does; the `remix/component` renderer lives in `@sdxc/qr/component`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { QrLevel, QrOptions } from "./encode.js";

export { QR, QrError } from "./encode.js";

export type { SvgPath, SvgPathOptions } from "./svg-path.js";
