/**
 * Sequence diagrams: participants and actors across the top, messages down the
 * page in the order written, with activations, notes, autonumbering and the
 * `loop`, `alt`, `opt`, `par`, `critical`, `break` and `rect` blocks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Head } from "./geometry.js";
import type { DiagramSource, Statement } from "./source.js";
import type { SvgElement, SvgNode } from "./tree.js";

import { connector, label, rect, svgRoot, translate } from "./draw.js";
import { DiagramError } from "./errors.js";
import { BACKGROUND, STROKE, TINT } from "./style.js";
import { LINE_HEIGHT, blockSize, splitLines, textWidth } from "./text.js";
import { element, num } from "./tree.js";

interface Participant {
	id: string;
	lines: string[];
	actor: boolean;
}

interface Message {
	kind: "message";
	from: string;
	to: string;
	lines: string[];
	stroke: "solid" | "dashed";
	start: Head;
	end: Head;
	activate: boolean;
	deactivate: boolean;
}

interface Activation {
	kind: "activate" | "deactivate";
	id: string;
	statement: Statement;
}

interface Note {
	kind: "note";
	placement: "left" | "right" | "over";
	ids: string[];
	lines: string[];
}

interface BlockStart {
	kind: "block";
	type: string;
	label: string;
	statement: Statement;
}

interface BlockSection {
	kind: "section";
	label: string;
	statement: Statement;
}

interface BlockEnd {
	kind: "end";
	statement: Statement;
}

type Event = Message | Activation | Note | BlockStart | BlockSection | BlockEnd;

/** An open block while the events inside it are laid out. */
interface OpenBlock {
	type: string;
	label: string;
	top: number;
	sections: { y: number; label: string }[];
	left: number;
	right: number;
}

/** The arrows a message can be written with, longest first so a prefix never wins. */
const ARROWS: Record<string, Pick<Message, "stroke" | "start" | "end">> = {
	"<<-->>": { stroke: "dashed", start: "arrow", end: "arrow" },
	"<<->>": { stroke: "solid", start: "arrow", end: "arrow" },
	"-->>": { stroke: "dashed", start: "none", end: "arrow" },
	"->>": { stroke: "solid", start: "none", end: "arrow" },
	"--x": { stroke: "dashed", start: "none", end: "cross" },
	"-x": { stroke: "solid", start: "none", end: "cross" },
	"--)": { stroke: "dashed", start: "none", end: "open" },
	"-)": { stroke: "solid", start: "none", end: "open" },
	"-->": { stroke: "dashed", start: "none", end: "none" },
	"->": { stroke: "solid", start: "none", end: "none" },
};

/** One message statement: sender, arrow, optional activation mark, receiver, text. */
const MESSAGE = new RegExp(
	`^(.+?)\\s*(${Object.keys(ARROWS)
		.map((arrow) => arrow.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&"))
		.join("|")})\\s*([+-]?)\\s*([^:]+?)\\s*(?::\\s*(.*))?$`,
);

/** Blocks a `section` may continue, and the keyword that does it. */
const SECTION_KEYWORDS: Record<string, string> = { alt: "else", par: "and", critical: "option" };

/** Space around the whole drawing. */
const MARGIN = 12;

/** Narrowest participant box. */
const MIN_BOX_WIDTH = 90;

/** Width of an activation bar, and how far a nested one shifts right. */
const ACTIVATION_WIDTH = 10;

/** Horizontal reach of a message to its own sender. */
const SELF_REACH = 32;

/**
 * Reads and draws a sequence diagram.
 *
 * @param diagram - The diagram after its header
 * @returns The drawing
 * @throws {DiagramError} At the first statement this subset does not read
 */
export function sequenceDiagram(diagram: DiagramSource): SvgElement {
	let { participants, events, numbered } = parse(diagram);
	return draw(diagram, participants, events, numbered);
}

/** Reads every statement, declaring participants as they are first named. */
function parse(diagram: DiagramSource): {
	participants: Participant[];
	events: Event[];
	numbered: boolean;
} {
	let participants = new Map<string, Participant>();
	let events: Event[] = [];
	let numbered = false;
	let open: string[] = [];

	let declare = (id: string): string => {
		let key = id.trim();
		if (!participants.has(key))
			participants.set(key, { id: key, lines: splitLines(key), actor: false });
		return key;
	};

	for (let statement of diagram.body) {
		let { text } = statement;
		let match: RegExpExecArray | null;

		if ((match = /^(participant|actor)\s+(.+?)(?:\s+as\s+(.+))?$/i.exec(text))) {
			let id = (match[2] ?? "").trim();
			participants.set(id, {
				id,
				lines: splitLines(match[3] ?? id),
				actor: match[1]?.toLowerCase() === "actor",
			});
			continue;
		}
		if (/^autonumber\b/i.test(text)) {
			numbered = true;
			continue;
		}
		if ((match = /^(activate|deactivate)\s+(.+)$/i.exec(text))) {
			let kind: Activation["kind"] =
				match[1]?.toLowerCase() === "activate" ? "activate" : "deactivate";
			events.push({ kind, id: declare(match[2] ?? ""), statement });
			continue;
		}
		if ((match = /^note\s+(left of|right of|over)\s+([^:]+?)\s*:\s*(.*)$/i.exec(text))) {
			let placement = (match[1] ?? "").toLowerCase().split(" ")[0] as Note["placement"];
			let ids = (match[2] ?? "").split(",").map(declare);
			if (ids.length > 2 || (ids.length === 2 && placement !== "over")) {
				throw new DiagramError(
					"A note spans at most two participants, and only over them",
					diagram.source,
					statement.index,
				);
			}
			events.push({ kind: "note", placement, ids, lines: splitLines(match[3] ?? "") });
			continue;
		}
		if ((match = /^(loop|alt|opt|par|critical|break|rect)\b\s*(.*)$/i.exec(text))) {
			let type = (match[1] ?? "").toLowerCase();
			open.push(type);
			events.push({ kind: "block", type, label: match[2] ?? "", statement });
			continue;
		}
		if ((match = /^(else|and|option)\b\s*(.*)$/i.exec(text))) {
			let keyword = (match[1] ?? "").toLowerCase();
			let current = open.at(-1);
			if (current === undefined || SECTION_KEYWORDS[current] !== keyword) {
				throw new DiagramError(
					`"${keyword}" outside a block it continues`,
					diagram.source,
					statement.index,
				);
			}
			events.push({ kind: "section", label: match[2] ?? "", statement });
			continue;
		}
		if (/^end$/i.test(text)) {
			if (open.pop() === undefined)
				throw new DiagramError('"end" without a block to close', diagram.source, statement.index);
			events.push({ kind: "end", statement });
			continue;
		}
		if ((match = MESSAGE.exec(text))) {
			let arrow = ARROWS[match[2] ?? ""];
			if (!arrow) continue;
			events.push({
				kind: "message",
				from: declare(match[1] ?? ""),
				to: declare(match[4] ?? ""),
				lines: splitLines(match[5] ?? ""),
				...arrow,
				activate: match[3] === "+",
				deactivate: match[3] === "-",
			});
			continue;
		}
		throw new DiagramError(
			`Unknown sequence diagram statement "${text}"`,
			diagram.source,
			statement.index,
		);
	}

	let unclosed = [...events].reverse().find((event) => event.kind === "block");
	if (open.length > 0 && unclosed?.kind === "block") {
		throw new DiagramError(
			`Unclosed "${unclosed.type}" block`,
			diagram.source,
			unclosed.statement.index,
		);
	}

	return { participants: [...participants.values()], events, numbered };
}

/** Lays the columns out from what each one must fit, then draws the events top to bottom. */
function draw(
	diagram: DiagramSource,
	participants: Participant[],
	events: Event[],
	numbered: boolean,
): SvgElement {
	let column = new Map(participants.map((participant, index) => [participant.id, index]));
	let widths = participants.map((participant) =>
		Math.max(MIN_BOX_WIDTH, blockSize(participant.lines).width + 32),
	);
	let headerHeight = Math.max(
		0,
		...participants.map((participant) => {
			let text = blockSize(participant.lines).height;
			return participant.actor ? 40 + text : text + 20;
		}),
	);

	let centers = solveColumns(participants, events, widths, column);
	let x = (id: string): number => centers[column.get(id) ?? 0] ?? 0;

	let background: SvgNode[] = [];
	let lifelines: SvgNode[] = [];
	let bars: SvgNode[] = [];
	let frames: SvgNode[] = [];
	let foreground: SvgNode[] = [];
	let left = Infinity;
	let right = -Infinity;
	let blocks: OpenBlock[] = [];

	let cover = (from: number, to: number): void => {
		left = Math.min(left, from);
		right = Math.max(right, to);
		for (let block of blocks) {
			block.left = Math.min(block.left, from);
			block.right = Math.max(block.right, to);
		}
	};

	let stacks = new Map<string, number[]>(participants.map((participant) => [participant.id, []]));
	let depth = (id: string): number => stacks.get(id)?.length ?? 0;
	let edge = (id: string, side: 1 | -1): number => {
		let level = depth(id);
		if (level === 0) return x(id);
		let offset = (level - 1) * (ACTIVATION_WIDTH / 2);
		return x(id) + offset + (side * ACTIVATION_WIDTH) / 2;
	};
	let finish = (id: string, at: number): void => {
		let stack = stacks.get(id) ?? [];
		let level = stack.length;
		let start = stack.pop();
		if (start === undefined) return;
		let offset = (level - 1) * (ACTIVATION_WIDTH / 2);
		bars.push(
			rect(
				x(id) + offset - ACTIVATION_WIDTH / 2,
				start,
				ACTIVATION_WIDTH,
				Math.max(at - start, 8),
				{
					style: BACKGROUND,
				},
			),
		);
	};

	let top = MARGIN;
	let y = top + headerHeight + 24;
	let number = 0;

	for (let event of events) {
		if (event.kind === "activate") {
			stacks.get(event.id)?.push(y - 6);
			continue;
		}
		if (event.kind === "deactivate") {
			if (depth(event.id) === 0) {
				throw new DiagramError(
					`"${event.id}" is not active`,
					diagram.source,
					event.statement.index,
				);
			}
			finish(event.id, y - 12);
			continue;
		}

		if (event.kind === "message") {
			let text = event.lines.some((line) => line !== "")
				? blockSize(event.lines)
				: { width: 0, height: 0 };
			number += 1;

			if (event.from === event.to) {
				if (event.activate) stacks.get(event.to)?.push(y);
				let start = edge(event.from, 1);
				let height = Math.max(22, text.height);
				let points = [
					{ x: start, y },
					{ x: start + SELF_REACH, y },
					{ x: start + SELF_REACH, y: y + height },
					{ x: edge(event.from, 1), y: y + height },
				];
				foreground.push(...connector(points, event.stroke, { start: event.start, end: event.end }));
				if (text.width > 0) {
					foreground.push(
						label(event.lines, start + SELF_REACH + 8, y + height / 2, { anchor: "start" }),
					);
				}
				if (numbered) foreground.push(badge(number, start, y));
				cover(x(event.from) - 10, start + SELF_REACH + 12 + text.width);
				if (event.deactivate) finish(event.from, y + height);
				y += height + 24;
				continue;
			}

			let textCenter = y + text.height / 2;
			y += text.height + (text.height > 0 ? 6 : 0);
			if (event.activate) stacks.get(event.to)?.push(y);
			let towardRight = x(event.to) > x(event.from);
			let start = edge(event.from, towardRight ? 1 : -1);
			let end = edge(event.to, towardRight ? -1 : 1);
			foreground.push(
				...connector(
					[
						{ x: start, y },
						{ x: end, y },
					],
					event.stroke,
					{ start: event.start, end: event.end },
				),
			);
			if (text.width > 0) foreground.push(label(event.lines, (start + end) / 2, textCenter));
			if (numbered) foreground.push(badge(number, start, y));
			let middle = (start + end) / 2;
			let outer = ACTIVATION_WIDTH + 4;
			cover(
				Math.min(x(event.from), x(event.to), middle - text.width / 2) - outer,
				Math.max(x(event.from), x(event.to), middle + text.width / 2) + outer,
			);
			if (event.deactivate) finish(event.from, y);
			y += 24;
			continue;
		}

		if (event.kind === "note") {
			let text = blockSize(event.lines);
			let width = Math.max(60, text.width + 20);
			let height = text.height + 14;
			let [first = "", second] = event.ids;
			let from: number;
			if (event.placement === "right") from = edge(first, 1) + 10;
			else if (event.placement === "left") from = edge(first, -1) - 10 - width;
			else {
				let a = x(first);
				let b = second === undefined ? a : x(second);
				let span = Math.abs(b - a) + (second === undefined ? 0 : 50);
				width = Math.max(width, span);
				from = (a + b) / 2 - width / 2;
			}
			y -= 4;
			foreground.push(rect(from, y, width, height, { style: TINT }));
			foreground.push(label(event.lines, from + width / 2, y + height / 2));
			cover(from, from + width);
			y += height + 18;
			continue;
		}

		if (event.kind === "block") {
			y -= 6;
			blocks.push({
				type: event.type,
				label: event.label,
				top: y,
				sections: [],
				left: Infinity,
				right: -Infinity,
			});
			y += event.type === "rect" ? 16 : LINE_HEIGHT + 22;
			continue;
		}

		if (event.kind === "section") {
			let block = blocks.at(-1);
			if (block) block.sections.push({ y: y - 6, label: event.label });
			y += LINE_HEIGHT + 16;
			continue;
		}

		let block = blocks.pop();
		if (!block) continue;
		y -= 4;
		let frameLeft = (Number.isFinite(block.left) ? block.left : (centers[0] ?? 0) - 40) - 14;
		let frameRight = (Number.isFinite(block.right) ? block.right : (centers[0] ?? 0) + 40) + 14;
		let tab = textWidth(block.type, { bold: true }) + 20;
		let condition = block.label ? `[${block.label}]` : "";
		frameRight = Math.max(frameRight, frameLeft + tab + textWidth(condition) + 24);
		if (block.type === "rect") {
			background.push(
				rect(frameLeft, block.top, frameRight - frameLeft, y - block.top, {
					style: TINT,
					stroke: false,
				}),
			);
		} else {
			frames.push(...frame(block, frameLeft, frameRight, y, tab, condition));
		}
		cover(frameLeft, frameRight);
		y += 18;
	}

	for (let participant of participants) {
		while (depth(participant.id) > 0) finish(participant.id, y - 6);
	}

	let bottom = y;
	for (let [index, participant] of participants.entries()) {
		let center = centers[index] ?? 0;
		let width = widths[index] ?? MIN_BOX_WIDTH;
		lifelines.push(
			element("path", {
				d: `M${num(center)} ${num(top + headerHeight)} V${num(bottom)}`,
				...STROKE,
				"stroke-width": "1",
				"stroke-dasharray": "4 4",
				fill: "none",
			}),
		);
		foreground.push(head(participant, center, top, width, headerHeight));
		foreground.push(head(participant, center, bottom, width, headerHeight));
		cover(center - width / 2, center + width / 2);
	}

	let width = right - left + 2 * MARGIN;
	let height = bottom + headerHeight + MARGIN;
	return svgRoot(width, height, diagram.title ?? "Sequence diagram", diagram.description, [
		translate(MARGIN - left, 0, [...background, ...lifelines, ...bars, ...frames, ...foreground]),
	]);
}

/**
 * Centers each column so every box, message label, note and self-message
 * fits: neighbors first, then each wider span in turn, spreading any shortfall
 * across the gaps it covers.
 */
function solveColumns(
	participants: readonly Participant[],
	events: readonly Event[],
	widths: readonly number[],
	column: ReadonlyMap<string, number>,
): number[] {
	let count = participants.length;
	let leftReach = widths.map((width) => width / 2);
	let rightReach = widths.map((width) => width / 2);
	let spans: { from: number; to: number; distance: number }[] = [];

	for (let event of events) {
		if (event.kind === "message") {
			let from = column.get(event.from) ?? 0;
			let to = column.get(event.to) ?? 0;
			let width = blockSize(event.lines).width;
			if (from === to) {
				rightReach[from] = Math.max(rightReach[from] ?? 0, SELF_REACH + width + 24);
			} else {
				spans.push({ from: Math.min(from, to), to: Math.max(from, to), distance: width + 40 });
			}
		}
		if (event.kind === "note") {
			let width = Math.max(60, blockSize(event.lines).width + 20);
			let first = column.get(event.ids[0] ?? "") ?? 0;
			let second = column.get(event.ids[1] ?? "");
			if (event.placement === "right")
				rightReach[first] = Math.max(rightReach[first] ?? 0, width + 20);
			else if (event.placement === "left")
				leftReach[first] = Math.max(leftReach[first] ?? 0, width + 20);
			else if (second === undefined) {
				leftReach[first] = Math.max(leftReach[first] ?? 0, width / 2 + 4);
				rightReach[first] = Math.max(rightReach[first] ?? 0, width / 2 + 4);
			} else {
				spans.push({
					from: Math.min(first, second),
					to: Math.max(first, second),
					distance: width - 50,
				});
			}
		}
	}

	let gaps = Array.from({ length: Math.max(0, count - 1) }, (_, index) =>
		Math.max(
			((widths[index] ?? 0) + (widths[index + 1] ?? 0)) / 2 + 24,
			(rightReach[index] ?? 0) + (leftReach[index + 1] ?? 0) + 12,
		),
	);
	spans.sort((a, b) => a.to - a.from - (b.to - b.from));
	for (let span of spans) {
		let current = gaps.slice(span.from, span.to).reduce((total, gap) => total + gap, 0);
		if (current >= span.distance) continue;
		let extra = (span.distance - current) / (span.to - span.from);
		for (let index = span.from; index < span.to; index += 1)
			gaps[index] = (gaps[index] ?? 0) + extra;
	}

	let centers = [0];
	for (let gap of gaps) centers.push((centers.at(-1) ?? 0) + gap);
	return centers;
}

/** A participant's box, or an actor's figure with its name beneath. */
function head(
	participant: Participant,
	center: number,
	top: number,
	width: number,
	height: number,
): SvgElement {
	if (!participant.actor) {
		return element("g", {}, [
			rect(center - width / 2, top, width, height, { style: BACKGROUND, radius: 3 }),
			label(participant.lines, center, top + height / 2),
		]);
	}
	let figure = [
		`M${num(center)} ${num(top + 14)} V${num(top + 26)}`,
		`M${num(center - 10)} ${num(top + 18)} H${num(center + 10)}`,
		`M${num(center - 8)} ${num(top + 36)} L${num(center)} ${num(top + 26)} L${num(center + 8)} ${num(top + 36)}`,
	].join(" ");
	let text = blockSize(participant.lines).height;
	return element("g", {}, [
		element("circle", { cx: num(center), cy: num(top + 8), r: "6", ...STROKE, style: BACKGROUND }),
		element("path", { d: figure, ...STROKE, fill: "none", "stroke-linecap": "round" }),
		label(participant.lines, center, top + height - text / 2),
	]);
}

/** The frame of a closed block: border, the tab naming its kind, its condition and its sections. */
function frame(
	block: OpenBlock,
	left: number,
	right: number,
	bottom: number,
	tab: number,
	condition: string,
): SvgNode[] {
	let tabHeight = LINE_HEIGHT + 6;
	let corner = `M${num(left)} ${num(block.top)} H${num(left + tab)} V${num(block.top + tabHeight - 6)} L${num(left + tab - 6)} ${num(block.top + tabHeight)} H${num(left)} Z`;
	let nodes: SvgNode[] = [
		rect(left, block.top, right - left, bottom - block.top),
		element("path", { d: corner, ...STROKE, style: TINT }),
		label([block.type], left + tab / 2 - 2, block.top + tabHeight / 2, { bold: true }),
	];
	if (condition)
		nodes.push(label([condition], left + tab + 10, block.top + tabHeight / 2, { anchor: "start" }));
	for (let section of block.sections) {
		nodes.push(
			element("path", {
				d: `M${num(left)} ${num(section.y)} H${num(right)}`,
				...STROKE,
				"stroke-dasharray": "6 4",
				fill: "none",
			}),
		);
		if (section.label)
			nodes.push(
				label([`[${section.label}]`], (left + right) / 2, section.y + LINE_HEIGHT / 2 + 6),
			);
	}
	return nodes;
}

/** The autonumber badge at the start of a message. */
function badge(value: number, x: number, y: number): SvgElement {
	return element("g", {}, [
		element("circle", { cx: num(x), cy: num(y), r: "9", style: "fill: currentColor" }),
		element(
			"text",
			{
				x: num(x),
				y: num(y),
				"text-anchor": "middle",
				"dominant-baseline": "central",
				"font-size": "10",
				"font-weight": "bold",
				style: "fill: var(--diagram-fill, Canvas)",
			},
			[{ type: "text", value: String(value) }],
		),
	]);
}
