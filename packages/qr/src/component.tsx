/**
 * The `remix/component` renderer for a QR symbol: an inline SVG with a light background
 * holding the quiet zone and one dark path. Its colors stay as authored under dark themes
 * and forced colors, since scanners need a dark code on a light margin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Handle, Props as TagProps } from "remix/component";

import { css } from "remix/component";

import type { QrSymbol } from "./encode.js";

import { svgPath } from "./svg-path.js";

/** The props {@link QrCode} accepts. */
export namespace QrCode {
	/** A symbol to draw and the accessible name that says what it is for. */
	export interface Props {
		/** A symbol from `encodeQr`. */
		symbol: QrSymbol;
		/** The image's accessible name; the payload itself stays out of the accessibility tree. */
		label: string;
		/**
		 * A CSS length for the rendered width and height.
		 *
		 * @default "12rem"
		 */
		size?: string;
		/**
		 * Quiet zone in modules.
		 *
		 * @default 4
		 */
		margin?: number;
		/**
		 * Module color; pair it with a `light` color of strong contrast.
		 *
		 * @default "#000"
		 */
		dark?: string;
		/**
		 * Background and quiet zone color.
		 *
		 * @default "#fff"
		 */
		light?: string;
		/** Mixins applied to the `<svg>`, after the package's own. */
		mix?: TagProps<"svg">["mix"];
	}
}

/**
 * Draws `symbol` as an SVG image named by `label`. `crispEdges` keeps rows seamless at
 * fractional scales, and `forced-color-adjust: none` keeps a high-contrast theme from
 * repainting the code light on dark.
 *
 * @param handle - Component handle exposing the symbol and presentation props
 * @returns A render function producing the `<svg>`
 * @example <QrCode symbol={symbol} label="Scan to add this account" size="10rem" />
 */
export function QrCode(handle: Handle<QrCode.Props>) {
	return () => {
		let {
			symbol,
			label,
			size = "12rem",
			margin = 4,
			dark = "#000",
			light = "#fff",
			mix,
		} = handle.props;
		let path = svgPath(symbol, { margin });

		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				role="img"
				aria-label={label}
				viewBox={path.viewBox}
				width={size}
				height={size}
				shapeRendering="crispEdges"
				mix={[css({ forcedColorAdjust: "none" }), mix]}
			>
				<rect width="100%" height="100%" fill={light} />
				<path d={path.d} fill={dark} />
			</svg>
		);
	};
}
