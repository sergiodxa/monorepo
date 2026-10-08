/**
 * The `remix/component` renderer for a QR symbol's path data: an inline SVG with a light
 * background holding the quiet zone and one dark path. Its props are plain JSON, so a
 * hydrated component can render it. Its colors stay as authored under dark themes
 * and forced colors, since scanners need a dark code on a light margin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Handle, Props as TagProps } from "remix/component";

import { css } from "remix/component";

import type { SvgPath } from "./svg-path.js";

/** The props {@link QrCode} accepts. */
export namespace QrCode {
	/** The path data to draw and the accessible name that says what it is for. */
	export interface Props {
		/** A symbol's path data from `qr.toSVGPath()`, which sets the quiet zone. */
		path: SvgPath;
		/** The image's accessible name; the payload itself stays out of the accessibility tree. */
		label: string;
		/**
		 * A CSS length for the rendered width and height.
		 *
		 * @default "12rem"
		 */
		size?: string;
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
 * Draws `path` as an SVG image named by `label`. `crispEdges` keeps rows seamless at
 * fractional scales, and `forced-color-adjust: none` keeps a high-contrast theme from
 * repainting the code light on dark.
 *
 * @param handle - Component handle exposing the path data and presentation props
 * @returns A render function producing the `<svg>`
 * @example <QrCode path={qr.toSVGPath()} label="Scan to add this account" size="10rem" />
 */
export function QrCode(handle: Handle<QrCode.Props>) {
	return () => {
		let { path, label, size = "12rem", dark = "#000", light = "#fff", mix } = handle.props;

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
