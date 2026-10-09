/**
 * Flowcharts: nodes in Mermaid's shapes, links with their labels, lengths and
 * heads, chains like `A --> B & C --> D`, and nested subgraphs, laid out in
 * ranks along the direction the header names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CompoundGroup, CompoundNode } from "./compound.js";
import type { Stroke } from "./draw.js";
import type { Box, Head, Outline, Point } from "./geometry.js";
import type { Direction, GraphEdge } from "./layered.js";
import type { DiagramSource } from "./source.js";
import type { SvgElement, SvgNode } from "./tree.js";

import { layoutCompound } from "./compound.js";
import { backedLabel, connector, label, rect, svgRoot, translate } from "./draw.js";
import { DiagramError } from "./errors.js";
import { clip } from "./geometry.js";
import { unquote } from "./source.js";
import { BACKGROUND, STROKE, TINT } from "./style.js";
import { blockSize, splitLines } from "./text.js";
import { element, num } from "./tree.js";

type Shape =
	| "rect"
	| "round"
	| "stadium"
	| "subroutine"
	| "cylinder"
	| "circle"
	| "doubleCircle"
	| "diamond"
	| "hexagon"
	| "parallelogram"
	| "parallelogramAlt"
	| "trapezoid"
	| "trapezoidAlt"
	| "flag";

interface FlowNode {
	id: string;
	lines: string[];
	shape: Shape;
	parent?: string;
}

interface FlowLink {
	lines: string[];
	stroke: Stroke;
	start: Head;
	end: Head;
	length: number;
}

interface FlowEdge extends FlowLink {
	from: string;
	to: string;
}

interface Subgraph {
	id: string;
	lines: string[];
	parent?: string;
	direction?: Direction;
}

/** Each opening bracket, and the closings it may pair with, longest first. */
const SHAPES: { open: string; closings: [string, Shape][] }[] = [
	{ open: "(((", closings: [[")))", "doubleCircle"]] },
	{ open: "([", closings: [["])", "stadium"]] },
	{ open: "[[", closings: [["]]", "subroutine"]] },
	{ open: "[(", closings: [[")]", "cylinder"]] },
	{ open: "((", closings: [["))", "circle"]] },
	{ open: "{{", closings: [["}}", "hexagon"]] },
	{
		open: "[/",
		closings: [
			["/]", "parallelogram"],
			["\\]", "trapezoid"],
		],
	},
	{
		open: "[\\",
		closings: [
			["\\]", "parallelogramAlt"],
			["/]", "trapezoidAlt"],
		],
	},
	{ open: "[", closings: [["]", "rect"]] },
	{ open: "(", closings: [[")", "round"]] },
	{ open: "{", closings: [["}", "diamond"]] },
	{ open: ">", closings: [["]", "flag"]] },
];

/** A node id: letters, digits and underscores in any script. */
const NODE_ID = /[\p{L}\p{N}_]+/uy;

/** A head on the target end; `o` and `x` count only when no id follows them directly. */
const TARGET_HEAD = "(>|[ox](?![\\p{L}\\p{N}_]))?";

/** A link written as one token, such as `-->`, `-.->`, `==>`, `o--o` or `~~~`. */
const PLAIN_LINK = new RegExp(`(<|[ox](?=[-=.]))?(-{2,}|={2,}|-\\.+-|~{3,})${TARGET_HEAD}`, "uy");

/** The opening half of a link with its text inside, such as `-- text -->`. */
const OPEN_TEXT_LINK = /(<|[ox])?(--|==|-\.)(?=\s)/y;

/** The closing half for each opening half. */
const CLOSE_TEXT_LINK: Record<string, RegExp> = {
	"--": new RegExp(`(-{2,})${TARGET_HEAD}`, "u"),
	"==": new RegExp(`(={2,})${TARGET_HEAD}`, "u"),
	"-.": new RegExp(`\\.(-+)${TARGET_HEAD}`, "u"),
};

/** Statements that style or script a chart; the drawing takes the page's colors instead. */
const STYLING = /^(classDef|class|style|linkStyle|click)\s/;

/** Space around the whole drawing. */
const MARGIN = 8;

/**
 * Reads and draws a flowchart.
 *
 * @param diagram - The diagram after its header
 * @param direction - The direction the header names, `TB` when it names none
 * @returns The drawing
 * @throws {DiagramError} At the first statement this subset does not read
 */
export function flowchart(diagram: DiagramSource, direction: string | undefined): SvgElement {
	let chart = parse(diagram, toDirection(direction ?? "TB"));
	return draw(diagram, chart);
}

/** Everything a flowchart declares, in declaration order. */
interface Chart {
	direction: Direction;
	nodes: Map<string, FlowNode>;
	edges: FlowEdge[];
	subgraphs: Map<string, Subgraph>;
}

/** Reads the statements, splitting any line on the semicolons between statements. */
function parse(diagram: DiagramSource, direction: Direction): Chart {
	let chart: Chart = { direction, nodes: new Map(), edges: [], subgraphs: new Map() };
	let stack: { subgraph: Subgraph; index: number }[] = [];

	for (let line of diagram.body) {
		for (let piece of splitStatements(line.text)) {
			let text = piece.text.trim();
			if (text === "") continue;
			let index = line.index + piece.offset + piece.text.indexOf(text);
			let current = stack.at(-1)?.subgraph;
			let match: RegExpExecArray | null;

			if ((match = /^subgraph\s+(.+)$/.exec(text))) {
				let subgraph = readSubgraph(match[1] ?? "", current?.id);
				chart.subgraphs.set(subgraph.id, subgraph);
				stack.push({ subgraph, index });
				continue;
			}
			if (text === "end") {
				if (!stack.pop())
					throw new DiagramError('"end" without a subgraph to close', diagram.source, index);
				continue;
			}
			if ((match = /^direction\s+(\w+)$/.exec(text))) {
				let value = toDirection(match[1] ?? "");
				if (current) current.direction = value;
				else chart.direction = value;
				continue;
			}
			if (STYLING.test(text)) continue;

			readChain(diagram.source, text, index, chart, current?.id);
		}
	}

	let unclosed = stack.at(-1);
	if (unclosed) throw new DiagramError("Unclosed subgraph", diagram.source, unclosed.index);

	for (let id of chart.subgraphs.keys()) chart.nodes.delete(id);
	return chart;
}

/** `subgraph id [title]`, `subgraph id`, or `subgraph Some title`, whose title is then its id. */
function readSubgraph(rest: string, parent: string | undefined): Subgraph {
	let titled = /^([\p{L}\p{N}_-]+)\s*\[(.*)\]$/u.exec(rest.trim());
	if (titled) return { id: titled[1] ?? "", lines: splitLines(unquote(titled[2] ?? "")), parent };
	let title = unquote(rest);
	return { id: rest.trim(), lines: splitLines(title), parent };
}

/**
 * Reads `A --> B & C -- text --> D`: groups of `&`-joined nodes separated by
 * links, where every node of one group links to every node of the next. A node
 * named inside a subgraph moves into it, wherever it was first named.
 */
function readChain(
	source: string,
	text: string,
	base: number,
	chart: Chart,
	parent: string | undefined,
): void {
	let cursor = { at: 0 };
	let fail = (reason: string, at = cursor.at): never => {
		throw new DiagramError(reason, source, base + at);
	};
	let skip = (): void => {
		while (cursor.at < text.length && /\s/.test(text[cursor.at] ?? "")) cursor.at += 1;
	};

	let readNode = (): string => {
		skip();
		NODE_ID.lastIndex = cursor.at;
		let id = NODE_ID.exec(text)?.[0];
		if (!id) return fail("Expected a node id");
		let start = cursor.at;
		cursor.at += id.length;

		let shaped = readShape(text, cursor.at);
		if (shaped === "unclosed") return fail(`Unclosed shape for "${id}"`, start);
		let existing = chart.nodes.get(id);
		let node = existing ?? { id, lines: [id], shape: "rect" };
		if (shaped) {
			cursor.at = shaped.end;
			node.lines = splitLines(shaped.text);
			node.shape = shaped.shape;
		}
		if (parent !== undefined) node.parent = parent;
		chart.nodes.set(id, node);

		let style = /:::[\w-]+/y;
		style.lastIndex = cursor.at;
		let styled = style.exec(text);
		if (styled) cursor.at += styled[0].length;
		return id;
	};

	let readGroup = (): string[] => {
		let ids = [readNode()];
		for (;;) {
			skip();
			if (text[cursor.at] !== "&") return ids;
			cursor.at += 1;
			ids.push(readNode());
		}
	};

	let groups = [readGroup()];
	let links: FlowLink[] = [];
	for (;;) {
		skip();
		if (cursor.at >= text.length) break;
		let link = readLink(text, cursor.at);
		if (!link) return void fail("Expected a link between nodes");
		cursor.at = link.end;
		links.push(link.link);
		groups.push(readGroup());
	}

	for (let [index, link] of links.entries()) {
		for (let from of groups[index] ?? []) {
			for (let to of groups[index + 1] ?? []) chart.edges.push({ from, to, ...link });
		}
	}
}

/**
 * Reads the shape brackets after a node id, if any.
 *
 * @returns The shape, its text and where it ends; `null` with no brackets; `"unclosed"` when they never close
 */
function readShape(
	text: string,
	at: number,
): { shape: Shape; text: string; end: number } | null | "unclosed" {
	let entry = SHAPES.find((candidate) => text.startsWith(candidate.open, at));
	if (!entry) return null;
	let start = at + entry.open.length;

	let quoted = /\s*"([^"]*)"\s*/y;
	quoted.lastIndex = start;
	let quote = quoted.exec(text);
	if (quote) {
		let after = start + quote[0].length;
		let closing = entry.closings.find(([close]) => text.startsWith(close, after));
		if (closing) return { shape: closing[1], text: quote[1] ?? "", end: after + closing[0].length };
	}

	let best: { shape: Shape; text: string; end: number; at: number } | null = null;
	for (let [close, shape] of entry.closings) {
		let found = text.indexOf(close, start);
		if (found === -1 || (best && found >= best.at)) continue;
		best = { shape, text: text.slice(start, found).trim(), end: found + close.length, at: found };
	}
	if (!best) return "unclosed";
	return { shape: best.shape, text: best.text, end: best.end };
}

/** Reads a link at `at`, with its text either inside it or after it between pipes. */
function readLink(text: string, at: number): { link: FlowLink; end: number } | null {
	OPEN_TEXT_LINK.lastIndex = at;
	let opening = OPEN_TEXT_LINK.exec(text);
	if (opening) {
		let kind = opening[2] ?? "--";
		let closing = CLOSE_TEXT_LINK[kind] as RegExp;
		let rest = text.slice(OPEN_TEXT_LINK.lastIndex);
		let close = closing.exec(rest);
		if (close) {
			let label = rest.slice(0, close.index).trim();
			let run = (close[1] ?? "").length;
			let head = close[2];
			let length = kind === "-." ? run : head ? run - 1 : run - 2;
			return {
				link: {
					lines: splitLines(unquote(label)),
					stroke: strokeOf(kind),
					start: headOf(opening[1]),
					end: headOf(head),
					length: Math.max(1, length),
				},
				end: OPEN_TEXT_LINK.lastIndex + close.index + close[0].length,
			};
		}
	}

	PLAIN_LINK.lastIndex = at;
	let plain = PLAIN_LINK.exec(text);
	if (!plain) return null;
	let body = plain[2] ?? "";
	let head = plain[3];
	if (/^-+$/.test(body) && !head && body.length < 3) return null;

	let length: number;
	if (body.startsWith("~")) length = 1;
	else if (body.includes(".")) length = body.length - 2;
	else length = head ? body.length - 1 : body.length - 2;

	let end = PLAIN_LINK.lastIndex;
	let lines: string[] = [];
	let piped = /\s*\|([^|]*)\|/y;
	piped.lastIndex = end;
	let pipe = piped.exec(text);
	if (pipe) {
		lines = splitLines(unquote(pipe[1] ?? ""));
		end = piped.lastIndex;
	}

	return {
		link: {
			lines,
			stroke: strokeOf(body),
			start: headOf(plain[1]),
			end: headOf(head),
			length: Math.max(1, length),
		},
		end,
	};
}

/** The stroke a link body draws with. */
function strokeOf(body: string): Stroke {
	if (body.startsWith("~")) return "invisible";
	if (body.startsWith("=")) return "thick";
	if (body.includes(".")) return "dotted";
	return "solid";
}

/** The head a link marker draws. */
function headOf(marker: string | undefined): Head {
	if (marker === ">" || marker === "<") return "arrow";
	if (marker === "o") return "circle";
	if (marker === "x") return "cross";
	return "none";
}

/** `TD` is Mermaid's other spelling of `TB`; anything unknown flows top to bottom. */
function toDirection(value: string): Direction {
	if (value === "LR" || value === "RL" || value === "BT") return value;
	return "TB";
}

/**
 * Splits a line on semicolons that end a statement, leaving those inside
 * quotes or brackets, where a label may hold one.
 */
function splitStatements(line: string): { text: string; offset: number }[] {
	let pieces: { text: string; offset: number }[] = [];
	let depth = 0;
	let quoted = false;
	let start = 0;
	for (let index = 0; index < line.length; index += 1) {
		let character = line[index];
		if (character === '"') quoted = !quoted;
		else if (!quoted && (character === "[" || character === "(" || character === "{")) depth += 1;
		else if (!quoted && (character === "]" || character === ")" || character === "}"))
			depth = Math.max(0, depth - 1);
		else if (!quoted && depth === 0 && character === ";") {
			pieces.push({ text: line.slice(start, index), offset: start });
			start = index + 1;
		}
	}
	pieces.push({ text: line.slice(start), offset: start });
	return pieces;
}

/** Sizes every node from its text, lays the chart out and draws it. */
function draw(diagram: DiagramSource, chart: Chart): SvgElement {
	let nodes: CompoundNode[] = [...chart.nodes.values()].map((node) => ({
		id: node.id,
		parent: node.parent,
		...sizeOf(node),
	}));
	let groups: CompoundGroup[] = [...chart.subgraphs.values()].map((subgraph) => {
		let size = blockSize(subgraph.lines);
		return {
			id: subgraph.id,
			parent: subgraph.parent,
			direction: subgraph.direction,
			header: { width: size.width + 16, height: size.height + 10 },
		};
	});
	let edges: GraphEdge[] = chart.edges.map((edge) => {
		let input: GraphEdge = { from: edge.from, to: edge.to, length: edge.length };
		if (edge.lines.some((line) => line !== "")) input.label = blockSize(edge.lines);
		return input;
	});

	let layout = layoutCompound({
		direction: chart.direction,
		nodes,
		groups,
		edges,
		nodeGap: 30,
		rankGap: 44,
	});

	let back: SvgNode[] = [];
	for (let [id, box] of layout.groups) {
		let subgraph = chart.subgraphs.get(id);
		let top = box.y - box.height / 2;
		back.push(rect(box.x - box.width / 2, top, box.width, box.height, { style: TINT, radius: 4 }));
		if (subgraph)
			back.push(label(subgraph.lines, box.x, top + 6 + blockSize(subgraph.lines).height / 2));
	}

	let lines: SvgNode[] = [];
	let labels: SvgNode[] = [];
	for (let [index, edge] of chart.edges.entries()) {
		let route = layout.edges[index];
		if (!route || route.points.length < 2) continue;
		let points = [...route.points];
		let fromBox = layout.nodes.get(edge.from) ?? layout.groups.get(edge.from);
		let toBox = layout.nodes.get(edge.to) ?? layout.groups.get(edge.to);
		if (fromBox)
			points[0] = clip(fromBox, outlineOf(chart.nodes.get(edge.from)), points[1] as Point);
		if (toBox) {
			points[points.length - 1] = clip(
				toBox,
				outlineOf(chart.nodes.get(edge.to)),
				points[points.length - 2] as Point,
			);
		}
		lines.push(...connector(points, edge.stroke, { start: edge.start, end: edge.end }));
		if (route.label && edge.stroke !== "invisible")
			labels.push(...backedLabel(edge.lines, route.label));
	}

	let shapes: SvgNode[] = [];
	for (let node of chart.nodes.values()) {
		let box = layout.nodes.get(node.id);
		if (box) shapes.push(...drawNode(node, box));
	}

	return svgRoot(
		layout.width + 2 * MARGIN,
		layout.height + 2 * MARGIN,
		diagram.title ?? "Flowchart",
		diagram.description,
		[translate(MARGIN, MARGIN, [...back, ...lines, ...shapes, ...labels])],
	);
}

/** The outline an edge is clipped to; a subgraph end clips as its box. */
function outlineOf(node: FlowNode | undefined): Outline {
	if (!node) return "rect";
	if (node.shape === "diamond") return "diamond";
	if (node.shape === "circle" || node.shape === "doubleCircle") return "ellipse";
	return "rect";
}

/** The size a node's shape needs to hold its text. */
function sizeOf(node: FlowNode): { width: number; height: number } {
	let text = blockSize(node.lines);
	let height = text.height + 20;
	switch (node.shape) {
		case "circle":
		case "doubleCircle": {
			let diameter = Math.max(text.width, text.height) + (node.shape === "circle" ? 24 : 34);
			return { width: diameter, height: diameter };
		}
		case "diamond":
			return {
				width: text.width + 2 * text.height + 24,
				height: text.height + text.width / 2 + 24,
			};
		case "stadium":
			return { width: text.width + height, height };
		case "hexagon":
		case "parallelogram":
		case "parallelogramAlt":
		case "trapezoid":
		case "trapezoidAlt":
			return { width: text.width + 24 + height, height };
		case "subroutine":
			return { width: text.width + 44, height };
		case "cylinder":
			return { width: text.width + 28, height: height + 16 };
		case "flag":
			return { width: text.width + 28 + height / 2, height };
		default:
			return { width: text.width + 28, height };
	}
}

/** A node's shape with its text centered in it. */
function drawNode(node: FlowNode, box: Box): SvgNode[] {
	let left = box.x - box.width / 2;
	let right = box.x + box.width / 2;
	let top = box.y - box.height / 2;
	let bottom = box.y + box.height / 2;
	let text = label(node.lines, box.x, box.y);
	let polygon = (points: [number, number][]): SvgElement =>
		element("polygon", {
			points: points.map(([x, y]) => `${num(x)},${num(y)}`).join(" "),
			...STROKE,
			"stroke-linejoin": "round",
			style: BACKGROUND,
		});

	switch (node.shape) {
		case "round":
			return [rect(left, top, box.width, box.height, { style: BACKGROUND, radius: 8 }), text];
		case "stadium":
			return [
				rect(left, top, box.width, box.height, { style: BACKGROUND, radius: box.height / 2 }),
				text,
			];
		case "subroutine":
			return [
				rect(left, top, box.width, box.height, { style: BACKGROUND }),
				element("path", {
					d: `M${num(left + 8)} ${num(top)} V${num(bottom)} M${num(right - 8)} ${num(top)} V${num(bottom)}`,
					...STROKE,
					fill: "none",
				}),
				text,
			];
		case "cylinder": {
			let rx = box.width / 2;
			let ry = 8;
			let rim = `M${num(left)} ${num(top + ry)} A${num(rx)} ${ry} 0 0 0 ${num(right)} ${num(top + ry)}`;
			let body = `M${num(left)} ${num(top + ry)} V${num(bottom - ry)} A${num(rx)} ${ry} 0 0 0 ${num(right)} ${num(bottom - ry)} V${num(top + ry)} A${num(rx)} ${ry} 0 0 0 ${num(left)} ${num(top + ry)} Z`;
			return [
				element("path", { d: body, ...STROKE, style: BACKGROUND }),
				element("path", { d: rim, ...STROKE, fill: "none" }),
				label(node.lines, box.x, box.y + ry / 2),
			];
		}
		case "circle":
			return [
				element("circle", {
					cx: num(box.x),
					cy: num(box.y),
					r: num(box.width / 2),
					...STROKE,
					style: BACKGROUND,
				}),
				text,
			];
		case "doubleCircle":
			return [
				element("circle", {
					cx: num(box.x),
					cy: num(box.y),
					r: num(box.width / 2),
					...STROKE,
					style: BACKGROUND,
				}),
				element("circle", {
					cx: num(box.x),
					cy: num(box.y),
					r: num(box.width / 2 - 5),
					...STROKE,
					fill: "none",
				}),
				text,
			];
		case "diamond":
			return [
				polygon([
					[box.x, top],
					[right, box.y],
					[box.x, bottom],
					[left, box.y],
				]),
				text,
			];
		case "hexagon": {
			let inset = Math.min(box.height / 2, box.width / 4);
			return [
				polygon([
					[left + inset, top],
					[right - inset, top],
					[right, box.y],
					[right - inset, bottom],
					[left + inset, bottom],
					[left, box.y],
				]),
				text,
			];
		}
		case "parallelogram":
		case "parallelogramAlt":
		case "trapezoid":
		case "trapezoidAlt": {
			let slant = box.height / 2;
			let corners: Record<string, [number, number][]> = {
				parallelogram: [
					[left + slant, top],
					[right, top],
					[right - slant, bottom],
					[left, bottom],
				],
				parallelogramAlt: [
					[left, top],
					[right - slant, top],
					[right, bottom],
					[left + slant, bottom],
				],
				trapezoid: [
					[left + slant, top],
					[right - slant, top],
					[right, bottom],
					[left, bottom],
				],
				trapezoidAlt: [
					[left, top],
					[right, top],
					[right - slant, bottom],
					[left + slant, bottom],
				],
			};
			return [polygon(corners[node.shape] ?? []), text];
		}
		case "flag": {
			let notch = box.height / 4;
			return [
				polygon([
					[left, top],
					[right, top],
					[right, bottom],
					[left, bottom],
					[left + notch, box.y],
				]),
				label(node.lines, box.x + notch / 2, box.y),
			];
		}
		default:
			return [rect(left, top, box.width, box.height, { style: BACKGROUND, radius: 2 }), text];
	}
}
