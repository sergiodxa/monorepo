/**
 * State diagrams: states with descriptions, start and end points per scope,
 * labelled transitions, choice, fork and join pseudo-states, notes, and
 * composite states that nest a diagram of their own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CompoundGroup, CompoundNode } from "./compound.js";
import type { Box, Outline, Point } from "./geometry.js";
import type { Direction, GraphEdge } from "./layered.js";
import type { DiagramSource, Statement } from "./source.js";
import type { SvgElement, SvgNode } from "./tree.js";

import { layoutCompound } from "./compound.js";
import { backedLabel, connector, label, rect, svgRoot, translate } from "./draw.js";
import { DiagramError } from "./errors.js";
import { clip } from "./geometry.js";
import { unquote } from "./source.js";
import { BACKGROUND, STROKE, TINT } from "./style.js";
import { LINE_HEIGHT, blockSize, splitLines } from "./text.js";
import { element, num } from "./tree.js";

type StateKind = "state" | "start" | "end" | "choice" | "fork" | "join";

interface State {
	id: string;
	lines: string[];
	descriptions: string[];
	kind: StateKind;
	parent?: string;
	composite: boolean;
}

interface Transition {
	from: string;
	to: string;
	lines: string[];
}

interface Note {
	id: string;
	lines: string[];
	target: string;
	side: "left" | "right";
}

/** A state id, or `[*]` for the scope's start or end. */
const ID = "\\[\\*\\]|[\\p{L}\\p{N}_]+";

/** `From --> To : label`, with an optional `:::style` on either end. */
const TRANSITION = new RegExp(
	`^(${ID})(?::::[\\w-]+)?\\s*-->\\s*(${ID})(?::::[\\w-]+)?\\s*(?::\\s*(.*))?$`,
	"u",
);

/** Statements that style a diagram; the drawing takes the page's colors instead. */
const STYLING = /^(classDef|class|style)\s/;

/** Space around the whole drawing. */
const MARGIN = 8;

/** The scope of the top level, which no state may take as its id. */
const ROOT = "";

/**
 * Reads and draws a state diagram.
 *
 * @param diagram - The diagram after its header
 * @returns The drawing
 * @throws {DiagramError} At the first statement this subset does not read
 */
export function stateDiagram(diagram: DiagramSource): SvgElement {
	return draw(diagram, parse(diagram));
}

interface Model {
	states: Map<string, State>;
	transitions: Transition[];
	notes: Note[];
	directions: Map<string, Direction>;
}

/** Reads every statement, declaring states in the composite they are first named in. */
function parse(diagram: DiagramSource): Model {
	let model: Model = {
		states: new Map(),
		transitions: [],
		notes: [],
		directions: new Map([[ROOT, "TB"]]),
	};
	let scopes: { id: string; statement: Statement }[] = [];
	let pendingNote: { note: Note; statement: Statement } | null = null;

	let scope = (): string => scopes.at(-1)?.id ?? ROOT;
	let declare = (id: string, end: "from" | "to"): string => {
		let key = id;
		let kind: StateKind = "state";
		if (id === "[*]") {
			kind = end === "from" ? "start" : "end";
			key = `\u0000${kind}:${scope()}`;
		}
		if (!model.states.has(key)) {
			let parent = scope() === ROOT ? undefined : scope();
			model.states.set(key, {
				id: key,
				lines: [id],
				descriptions: [],
				kind,
				parent,
				composite: false,
			});
		}
		return key;
	};

	for (let statement of diagram.body) {
		let { text } = statement;
		let match: RegExpExecArray | null;

		if (pendingNote) {
			if (/^end\s+note$/i.test(text)) {
				model.notes.push(pendingNote.note);
				pendingNote = null;
			} else {
				pendingNote.note.lines.push(...splitLines(text));
			}
			continue;
		}

		if ((match = /^direction\s+(TB|TD|BT|LR|RL)$/.exec(text))) {
			let value = match[1] === "TD" ? "TB" : (match[1] as Direction);
			model.directions.set(scope(), value);
			continue;
		}
		if ((match = TRANSITION.exec(text))) {
			model.transitions.push({
				from: declare(match[1] ?? "", "from"),
				to: declare(match[2] ?? "", "to"),
				lines: match[3] ? splitLines(match[3]) : [],
			});
			continue;
		}
		if ((match = /^state\s+"([^"]*)"\s+as\s+([\p{L}\p{N}_]+)\s*(\{)?$/u.exec(text))) {
			let state = model.states.get(declare(match[2] ?? "", "from")) as State;
			state.lines = splitLines(match[1] ?? "");
			if (match[3]) open(state, statement);
			continue;
		}
		if ((match = /^state\s+([\p{L}\p{N}_]+)\s*(<<(choice|fork|join)>>)?\s*(\{)?$/u.exec(text))) {
			let state = model.states.get(declare(match[1] ?? "", "from")) as State;
			if (match[3]) state.kind = match[3] as StateKind;
			if (match[4]) open(state, statement);
			continue;
		}
		if (text === "}") {
			if (!scopes.pop())
				throw new DiagramError(
					'"}" without a composite state to close',
					diagram.source,
					statement.index,
				);
			continue;
		}
		if ((match = /^note\s+(left|right)\s+of\s+([\p{L}\p{N}_]+)\s*(?::\s*(.*))?$/iu.exec(text))) {
			let note: Note = {
				id: `\u0000note${model.notes.length + (pendingNote ? 1 : 0)}`,
				lines: match[3] === undefined ? [] : splitLines(match[3]),
				target: declare(match[2] ?? "", "from"),
				side: (match[1] ?? "right").toLowerCase() as Note["side"],
			};
			if (match[3] === undefined) pendingNote = { note, statement };
			else model.notes.push(note);
			continue;
		}
		if ((match = /^([\p{L}\p{N}_]+)\s*:\s*(.+)$/u.exec(text))) {
			let state = model.states.get(declare(match[1] ?? "", "from")) as State;
			state.descriptions.push(...splitLines(unquote(match[2] ?? "")));
			continue;
		}
		if (text === "--") {
			throw new DiagramError(
				"Concurrent regions are not supported",
				diagram.source,
				statement.index,
			);
		}
		if (STYLING.test(text)) continue;
		if ((match = /^([\p{L}\p{N}_]+)$/u.exec(text))) {
			declare(match[1] ?? "", "from");
			continue;
		}
		throw new DiagramError(
			`Unknown state diagram statement "${text}"`,
			diagram.source,
			statement.index,
		);
	}

	if (pendingNote)
		throw new DiagramError(
			'Unclosed note; end it with "end note"',
			diagram.source,
			pendingNote.statement.index,
		);
	let unclosed = scopes.at(-1);
	if (unclosed)
		throw new DiagramError(
			`Unclosed composite state "${unclosed.id}"`,
			diagram.source,
			unclosed.statement.index,
		);
	return model;

	/** Opens a composite: the states named until its `}` belong to it. */
	function open(state: State, statement: Statement): void {
		state.composite = true;
		scopes.push({ id: state.id, statement });
	}
}

/** The flow inside the composite that holds a state, inherited from the nearest one that sets it. */
function directionOf(model: Model, scope: string | undefined): Direction {
	let current = scope;
	while (current !== undefined && current !== ROOT) {
		let set = model.directions.get(current);
		if (set) return set;
		current = model.states.get(current)?.parent;
	}
	return model.directions.get(ROOT) ?? "TB";
}

/** The size a state's shape takes, with fork and join bars set across the flow they sit in. */
function sizeOf(model: Model, state: State): { width: number; height: number } {
	if (state.kind === "start") return { width: 18, height: 18 };
	if (state.kind === "end") return { width: 22, height: 22 };
	if (state.kind === "choice") return { width: 30, height: 30 };
	if (state.kind === "fork" || state.kind === "join") {
		let flow = directionOf(model, state.parent);
		return flow === "LR" || flow === "RL" ? { width: 8, height: 80 } : { width: 80, height: 8 };
	}
	let name = blockSize(state.lines);
	let description = blockSize(state.descriptions);
	let height = name.height + 16 + (state.descriptions.length > 0 ? description.height + 10 : 0);
	return { width: Math.max(70, name.width + 28, description.width + 24), height };
}

/** Lays the states out and draws composites, transitions, states and notes. */
function draw(diagram: DiagramSource, model: Model): SvgElement {
	let nodes: CompoundNode[] = [];
	let groups: CompoundGroup[] = [];
	for (let state of model.states.values()) {
		if (state.composite) {
			let size = blockSize(state.lines);
			groups.push({
				id: state.id,
				parent: state.parent,
				direction: model.directions.get(state.id),
				header: { width: size.width + 16, height: size.height + 14 },
			});
		} else {
			nodes.push({ id: state.id, parent: state.parent, ...sizeOf(model, state) });
		}
	}
	for (let note of model.notes) {
		let size = blockSize(note.lines);
		nodes.push({
			id: note.id,
			parent: model.states.get(note.target)?.parent,
			width: size.width + 20,
			height: size.height + 14,
		});
	}

	let edges: GraphEdge[] = model.transitions.map((transition) => {
		let edge: GraphEdge = { from: transition.from, to: transition.to };
		if (transition.lines.length > 0) edge.label = blockSize(transition.lines);
		return edge;
	});
	let noteEdges = new Map<string, number>();
	for (let note of model.notes) {
		noteEdges.set(note.id, edges.length);
		edges.push(
			note.side === "left"
				? { from: note.id, to: note.target }
				: { from: note.target, to: note.id },
		);
	}

	let layout = layoutCompound({
		direction: directionOf(model, undefined),
		nodes,
		groups,
		edges,
		nodeGap: 36,
		rankGap: 44,
	});
	let boxOf = (id: string): Box | undefined => layout.nodes.get(id) ?? layout.groups.get(id);

	let back: SvgNode[] = [];
	for (let [id, box] of layout.groups) {
		let state = model.states.get(id);
		if (!state) continue;
		let top = box.y - box.height / 2;
		let left = box.x - box.width / 2;
		let header = blockSize(state.lines).height + 14;
		back.push(rect(left, top, box.width, box.height, { style: BACKGROUND, radius: 8 }));
		back.push(label(state.lines, box.x, top + header / 2));
		back.push(
			element("path", {
				d: `M${num(left)} ${num(top + header)} H${num(left + box.width)}`,
				...STROKE,
				fill: "none",
			}),
		);
	}

	let lines: SvgNode[] = [];
	let labels: SvgNode[] = [];
	let route = (index: number, from: string, to: string): Point[] | null => {
		let placed = layout.edges[index];
		let fromBox = boxOf(from);
		let toBox = boxOf(to);
		if (!placed || placed.points.length < 2 || !fromBox || !toBox) return null;
		let points = [...placed.points];
		points[0] = clip(fromBox, outlineOf(model.states.get(from)), points[1] as Point);
		points[points.length - 1] = clip(
			toBox,
			outlineOf(model.states.get(to)),
			points[points.length - 2] as Point,
		);
		return points;
	};
	for (let [index, transition] of model.transitions.entries()) {
		let points = route(index, transition.from, transition.to);
		if (!points) continue;
		lines.push(...connector(points, "solid", { end: "arrow" }));
		let center = layout.edges[index]?.label;
		if (center) labels.push(...backedLabel(transition.lines, center));
	}
	for (let note of model.notes) {
		let index = noteEdges.get(note.id) ?? -1;
		let points =
			note.side === "left"
				? route(index, note.id, note.target)
				: route(index, note.target, note.id);
		if (points) lines.push(...connector(points, "dashed"));
	}

	let shapes: SvgNode[] = [];
	for (let state of model.states.values()) {
		let box = layout.nodes.get(state.id);
		if (box) shapes.push(...drawState(state, box));
	}
	for (let note of model.notes) {
		let box = layout.nodes.get(note.id);
		if (!box) continue;
		shapes.push(
			rect(box.x - box.width / 2, box.y - box.height / 2, box.width, box.height, { style: TINT }),
		);
		shapes.push(label(note.lines, box.x, box.y));
	}

	return svgRoot(
		layout.width + 2 * MARGIN,
		layout.height + 2 * MARGIN,
		diagram.title ?? "State diagram",
		diagram.description,
		[translate(MARGIN, MARGIN, [...back, ...lines, ...shapes, ...labels])],
	);
}

/** The outline a transition is clipped to. */
function outlineOf(state: State | undefined): Outline {
	if (state?.kind === "start" || state?.kind === "end") return "ellipse";
	if (state?.kind === "choice") return "diamond";
	return "rect";
}

/** A state's shape: a rounded box with its name over its descriptions, or a pseudo-state's mark. */
function drawState(state: State, box: Box): SvgNode[] {
	let left = box.x - box.width / 2;
	let top = box.y - box.height / 2;
	if (state.kind === "start") {
		return [
			element("circle", {
				cx: num(box.x),
				cy: num(box.y),
				r: num(box.width / 2),
				style: "fill: currentColor",
			}),
		];
	}
	if (state.kind === "end") {
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
				r: num(box.width / 2 - 4.5),
				style: "fill: currentColor",
			}),
		];
	}
	if (state.kind === "choice") {
		let points = [
			[box.x, top],
			[left + box.width, box.y],
			[box.x, top + box.height],
			[left, box.y],
		];
		return [
			element("polygon", {
				points: points.map(([x, y]) => `${num(x ?? 0)},${num(y ?? 0)}`).join(" "),
				...STROKE,
				style: BACKGROUND,
			}),
		];
	}
	if (state.kind === "fork" || state.kind === "join") {
		return [
			rect(left, top, box.width, box.height, {
				style: "fill: currentColor",
				stroke: false,
				radius: 2,
			}),
		];
	}

	let name = blockSize(state.lines).height + 16;
	let nodes: SvgNode[] = [
		rect(left, top, box.width, box.height, { style: BACKGROUND, radius: 8 }),
		label(state.lines, box.x, top + name / 2),
	];
	if (state.descriptions.length > 0) {
		nodes.push(
			element("path", {
				d: `M${num(left)} ${num(top + name)} H${num(left + box.width)}`,
				...STROKE,
				fill: "none",
			}),
		);
		nodes.push(
			label(
				state.descriptions,
				box.x,
				top + name + 5 + (state.descriptions.length * LINE_HEIGHT) / 2,
			),
		);
	}
	return nodes;
}
