/**
 * The vocabulary every drawing call shares: colours, gradients, the paints built from them,
 * and the options and metrics of filled paths and text. Types only, so importing it costs
 * nothing at runtime.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Font } from "@sdxc/font";

export namespace Raster {
	/** An sRGB colour with straight alpha, every channel in `0–1`. */
	export interface Color {
		r: number;
		g: number;
		b: number;
		a: number;
	}

	/** A canvas coordinate in pixels, y down. */
	export type Point = [x: number, y: number];

	/** One colour stop: where along the gradient (`0–1`) the colour is reached. */
	export type Stop = [offset: number, color: Color];

	/** A gradient along the line from `from` to `to`, padded with its end colours past both ends. */
	export interface LinearGradient {
		kind: "linear";
		from: Point;
		to: Point;
		stops: Stop[];
	}

	/**
	 * A gradient outward from `center`, reaching offset 1 at `radius`; two radii make it an
	 * ellipse, as CSS `radial-gradient(rx ry at x y)` does.
	 */
	export interface RadialGradient {
		kind: "radial";
		center: Point;
		radius: number | [rx: number, ry: number];
		stops: Stop[];
	}

	/** What a fill paints with: one colour, or a colour that varies with position. */
	export type Paint = Color | LinearGradient | RadialGradient;

	/** How overlapping contours of one path decide what is inside. */
	export interface FillOptions {
		/** @default "nonzero" */
		rule?: "nonzero" | "evenodd";
	}

	/** Options for a layer composited as one image once its drawing finishes. */
	export interface LayerOptions {
		/** @default 1 */
		opacity?: number;
	}

	/** Where and how a run of text is laid out, and the box it must fit. */
	export interface TextOptions {
		font: Font;
		/** Pixels per em before any shrinking to fit. */
		size: number;
		/** The anchor `align` positions each line against. */
		x: number;
		/** The first line's baseline. */
		y: number;
		/** @default "start" */
		align?: "start" | "center" | "end";
		/** Extra pixels after every glyph at `size`, scaled down with the text when it shrinks. */
		tracking?: number;
		/** Baseline distance as a multiple of the fitted size. @default 1.15 */
		lineHeight?: number;
		/** Wraps at spaces to this width; text without it stays on one line. */
		maxWidth?: number;
		/** Shrinks, then truncates with an ellipsis, to stay within this many lines. */
		maxLines?: number;
		/** The smallest size shrinking may reach. @default size */
		minSize?: number;
		/** @default true */
		kerning?: boolean;
		/** Required by `text`, ignored by `measureText`. */
		paint?: Paint;
	}

	/** Where text landed, so a caller can place what follows it. */
	export interface TextMetrics {
		/** The size the text was drawn at after fitting. */
		size: number;
		lines: string[];
		/** The widest line, in pixels. */
		width: number;
		/** Line count times the fitted line height. */
		height: number;
	}
}
