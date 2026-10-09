/**
 * The SVG primitives every diagram is drawn with: labels measured into lines,
 * rectangles, connectors with their heads, and the root element that names the
 * diagram for assistive technology.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Head, Point } from "./geometry.js";
import type { SvgElement, SvgNode } from "./tree.js";

import { drawHead, pathData } from "./geometry.js";
import { BACKGROUND, STROKE } from "./style.js";
import { FONT_SIZE, LINE_HEIGHT, blockSize } from "./text.js";
import { element, num } from "./tree.js";

/** How a line is stroked. */
export type Stroke = "solid" | "dashed" | "dotted" | "thick" | "invisible";

/** How a label is placed and styled. */
export interface LabelOptions {
	/** Which side of `x` the text sits on. */
	anchor?: "start" | "middle" | "end";
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
}

/**
 * Text whose lines are centered vertically on `y`, one `tspan` per line.
 *
 * @param lines - The label's lines
 * @param x - Where the text anchors horizontally
 * @param y - The vertical center of the whole block
 * @param options - Anchor and style
 * @returns The `text` element
 */
export function label(
	lines: readonly string[],
	x: number,
	y: number,
	options: LabelOptions = {},
): SvgElement {
	let top = y - ((lines.length - 1) * LINE_HEIGHT) / 2;
	let attributes: Record<string, string> = {
		x: num(x),
		y: num(top),
		"text-anchor": options.anchor ?? "middle",
		"dominant-baseline": "central",
		fill: "currentColor",
	};
	if (options.bold) attributes["font-weight"] = "bold";
	if (options.italic) attributes["font-style"] = "italic";
	if (options.underline) attributes["text-decoration"] = "underline";

	if (lines.length === 1)
		return element("text", attributes, [{ type: "text", value: lines[0] ?? "" }]);
	let spans = lines.map((line, index) =>
		element("tspan", { x: num(x), y: num(top + index * LINE_HEIGHT) }, [
			{ type: "text", value: line },
		]),
	);
	return element("text", attributes, spans);
}

/**
 * A label on a background-filled box, which is how a line's label stays
 * readable where it crosses the line.
 *
 * @param lines - The label's lines
 * @param center - Where the label is centered
 * @returns The box and the text, or nothing for an empty label
 */
export function backedLabel(lines: readonly string[], center: Point): SvgNode[] {
	if (lines.every((line) => line === "")) return [];
	let size = blockSize(lines);
	let box = rect(
		center.x - size.width / 2 - 3,
		center.y - size.height / 2,
		size.width + 6,
		size.height,
		{
			style: BACKGROUND,
			stroke: false,
		},
	);
	return [box, label(lines, center.x, center.y)];
}

/** How a rectangle is drawn. */
export interface RectOptions {
	radius?: number;
	style?: string;
	/** @default true */
	stroke?: boolean;
	dashed?: boolean;
}

/**
 * @param x - Left edge
 * @param y - Top edge
 * @param width - Width
 * @param height - Height
 * @param options - Corners, fill and stroke
 * @returns The `rect` element
 */
export function rect(
	x: number,
	y: number,
	width: number,
	height: number,
	options: RectOptions = {},
): SvgElement {
	let attributes: Record<string, string> = {
		x: num(x),
		y: num(y),
		width: num(width),
		height: num(height),
	};
	if (options.radius) attributes.rx = num(options.radius);
	if (options.stroke !== false) Object.assign(attributes, STROKE);
	if (options.dashed) attributes["stroke-dasharray"] = "5 4";
	attributes.style = options.style ?? "fill: none";
	return element("rect", attributes);
}

/**
 * A line through the points with a head at either end. The line stops at each
 * head's base, so a hollow head never shows the line through it.
 *
 * @param points - The route, at least two points
 * @param stroke - How it is stroked
 * @param heads - What each end carries
 * @returns The path followed by its heads
 */
export function connector(
	points: readonly Point[],
	stroke: Stroke,
	heads: { start?: Head; end?: Head } = {},
): SvgElement[] {
	if (stroke === "invisible" || points.length < 2) return [];
	let route = [...points];
	let shapes: SvgElement[] = [];

	let last = route.length - 1;
	let end = drawHead(heads.end ?? "none", route[last] as Point, route[last - 1] as Point);
	route[last] = end.base;
	let start = drawHead(heads.start ?? "none", route[0] as Point, route[1] as Point);
	route[0] = start.base;
	if (end.shape) shapes.push(end.shape);
	if (start.shape) shapes.push(start.shape);

	let attributes: Record<string, string> = {
		d: pathData(route),
		...STROKE,
		fill: "none",
	};
	if (stroke === "thick") attributes["stroke-width"] = "3";
	if (stroke === "dashed") attributes["stroke-dasharray"] = "6 4";
	if (stroke === "dotted") attributes["stroke-dasharray"] = "2 3";

	return [element("path", attributes), ...shapes];
}

/**
 * The root element. It scales down to its container, carries the font every
 * label is measured in, and names itself for assistive technology. Its `fill`
 * is what a fill the reader's engine cannot resolve falls back to.
 *
 * @param width - Content width
 * @param height - Content height
 * @param name - What the diagram is, read out as its accessible name
 * @param description - A longer description, when the author wrote one
 * @param children - The drawing
 * @returns The `svg` element
 */
export function svgRoot(
	width: number,
	height: number,
	name: string,
	description: string | undefined,
	children: SvgNode[],
): SvgElement {
	let accessible: SvgNode[] = [element("title", {}, [{ type: "text", value: name }])];
	if (description) accessible.push(element("desc", {}, [{ type: "text", value: description }]));

	return element(
		"svg",
		{
			xmlns: "http://www.w3.org/2000/svg",
			viewBox: `0 0 ${num(width)} ${num(height)}`,
			width: num(width),
			height: num(height),
			role: "img",
			fill: "none",
			"font-family": "ui-sans-serif, system-ui, sans-serif",
			"font-size": String(FONT_SIZE),
			style: "max-width: 100%; height: auto",
		},
		[...accessible, ...children],
	);
}

/**
 * @param x - Horizontal offset
 * @param y - Vertical offset
 * @param children - What to move
 * @returns A group translated by the offset
 */
export function translate(x: number, y: number, children: SvgNode[]): SvgElement {
	return element("g", { transform: `translate(${num(x)} ${num(y)})` }, children);
}
