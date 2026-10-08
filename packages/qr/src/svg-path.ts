/**
 * Turns a symbol into SVG path data: one rectangle per horizontal run of dark modules, in
 * a coordinate space of one unit per module with the quiet zone included. It returns
 * attribute values, so the caller's renderer owns the markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { QrSymbol } from "./encode.js";

/** How `svgPath` frames the symbol. */
export interface SvgPathOptions {
	/**
	 * Light modules around the symbol. The standard asks for 4; a smaller value suits a code
	 * inside a light container that already provides the margin.
	 *
	 * @default 4
	 */
	margin?: number;
}

/** Attribute values for an `<svg viewBox>` holding one `<path d>`. */
export interface SvgPath {
	/** Every dark module, as `M x y h w v 1 h -w z` rectangles merged along each row. */
	d: string;
	/** `0 0 size size`. */
	viewBox: string;
	/** Modules a side, quiet zone included. */
	size: number;
}

/**
 * Path data for `symbol`, offset by `margin` so the viewBox includes the quiet zone.
 *
 * @param symbol - A symbol from `encodeQr`
 * @param options - The quiet zone width
 * @returns The path, its viewBox and its side length in modules
 * @example let { d, viewBox } = svgPath(symbol);
 */
export function svgPath(symbol: QrSymbol, options: SvgPathOptions = {}): SvgPath {
	let { margin = 4 } = options;
	let commands: string[] = [];

	for (let y = 0; y < symbol.size; y++) {
		let x = 0;
		while (x < symbol.size) {
			if (!symbol.isDark(x, y)) {
				x++;
				continue;
			}
			let start = x;
			while (symbol.isDark(x, y)) x++;
			let width = x - start;
			commands.push(`M${start + margin} ${y + margin}h${width}v1h-${width}z`);
		}
	}

	let size = symbol.size + margin * 2;
	return { d: commands.join(""), viewBox: `0 0 ${size} ${size}`, size };
}
