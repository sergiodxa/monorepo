/**
 * Class diagrams: classes with annotations, generics, attributes and methods,
 * the UML relations between them with labels and cardinalities, notes, and
 * namespaces, laid out so parents and wholes sit above what refers to them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CompoundGroup, CompoundNode } from "./compound.js";
import type { Stroke } from "./draw.js";
import type { Box, Head, Point } from "./geometry.js";
import type { Direction, GraphEdge } from "./layered.js";
import type { DiagramSource, Statement } from "./source.js";
import type { SvgElement, SvgNode } from "./tree.js";

import { layoutCompound } from "./compound.js";
import { backedLabel, connector, label, rect, svgRoot, translate } from "./draw.js";
import { DiagramError } from "./errors.js";
import { clip, distance } from "./geometry.js";
import { unquote } from "./source.js";
import { BACKGROUND, STROKE, TINT } from "./style.js";
import { LINE_HEIGHT, blockSize, splitLines, textWidth } from "./text.js";
import { element, num } from "./tree.js";

interface Member {
	text: string;
	isStatic: boolean;
	isAbstract: boolean;
}

interface ClassBox {
	id: string;
	name: string;
	annotations: string[];
	attributes: Member[];
	methods: Member[];
	parent?: string;
}

interface Relation {
	from: string;
	to: string;
	start: Head;
	end: Head;
	stroke: Stroke;
	lines: string[];
	fromCardinality?: string;
	toCardinality?: string;
	/** Laid out from `to` to `from`, which puts a parent or a whole above its children. */
	upward: boolean;
}

interface Note {
	id: string;
	lines: string[];
	target?: string;
}

/** A class name: letters, digits and underscores, with optional `~T~` generics. */
const NAME = "[\\p{L}\\p{N}_]+";

/** `From "1" <|-- "many" To : label`, every part beside the two names and the line optional. */
const RELATION = new RegExp(
	`^(${NAME})(?:~[^~]*~)?\\s*(?:"([^"]*)"\\s*)?(<\\||\\*|o|<)?(--|\\.\\.)(\\|>|\\*|o|>)?\\s*(?:"([^"]*)"\\s*)?(${NAME})(?:~[^~]*~)?\\s*(?::\\s*(.*))?$`,
	"u",
);

/** `class Name~T~["Label"]:::style {`, with only the name required. */
const CLASS = new RegExp(
	`^class\\s+(${NAME})(~[^~]*~)?(?:\\["([^"]*)"\\])?(?::::[\\w-]+)?\\s*(\\{)?\\s*(\\})?$`,
	"u",
);

/** Statements that style or script a diagram; the drawing takes the page's colors instead. */
const STYLING = /^(style|classDef|cssClass|click|link|callback)\s/;

/** Space around the whole drawing. */
const MARGIN = 8;

/** Extra length a relation with cardinalities takes, so they clear its label. */
const CARDINALITY_ROOM = 2 * LINE_HEIGHT;

/** Padding inside each compartment. */
const PADDING = 8;

/**
 * Reads and draws a class diagram.
 *
 * @param diagram - The diagram after its header
 * @returns The drawing
 * @throws {DiagramError} At the first statement this subset does not read
 */
export function classDiagram(diagram: DiagramSource): SvgElement {
	let model = parse(diagram);
	return draw(diagram, model);
}

interface Model {
	direction: Direction;
	classes: Map<string, ClassBox>;
	relations: Relation[];
	notes: Note[];
	namespaces: Map<string, string | undefined>;
}

/** Reads every statement, declaring classes as they are first named. */
function parse(diagram: DiagramSource): Model {
	let model: Model = {
		direction: "TB",
		classes: new Map(),
		relations: [],
		notes: [],
		namespaces: new Map(),
	};
	let body: { box: ClassBox; statement: Statement } | null = null;
	let namespaces: { id: string; statement: Statement }[] = [];

	let declare = (id: string): ClassBox => {
		let existing = model.classes.get(id);
		if (existing) return existing;
		let box: ClassBox = {
			id,
			name: id,
			annotations: [],
			attributes: [],
			methods: [],
			parent: namespaces.at(-1)?.id,
		};
		model.classes.set(id, box);
		return box;
	};

	for (let statement of diagram.body) {
		let { text } = statement;
		let match: RegExpExecArray | null;

		if (body) {
			if (text === "}") {
				body = null;
				continue;
			}
			let annotation = /^<<(.+)>>$/.exec(text);
			if (annotation) body.box.annotations.push(annotation[1] ?? "");
			else addMember(body.box, text);
			continue;
		}

		if ((match = /^direction\s+(TB|TD|BT|LR|RL)$/.exec(text))) {
			let value = match[1] === "TD" ? "TB" : match[1];
			model.direction = (value ?? "TB") as Direction;
			continue;
		}
		if ((match = new RegExp(`^namespace\\s+(${NAME})\\s*\\{$`, "u").exec(text))) {
			let id = match[1] ?? "";
			model.namespaces.set(id, namespaces.at(-1)?.id);
			namespaces.push({ id, statement });
			continue;
		}
		if (text === "}") {
			if (!namespaces.pop())
				throw new DiagramError('"}" without a block to close', diagram.source, statement.index);
			continue;
		}
		if ((match = CLASS.exec(text))) {
			let box = declare(match[1] ?? "");
			box.name = match[3] ?? `${box.id}${match[2] ? generics(match[2]) : ""}`;
			if (match[4] && !match[5]) body = { box, statement };
			continue;
		}
		if ((match = new RegExp(`^<<(.+)>>\\s*(${NAME})$`, "u").exec(text))) {
			declare(match[2] ?? "").annotations.push(match[1] ?? "");
			continue;
		}
		if ((match = new RegExp(`^note\\s+for\\s+(${NAME})\\s+"(.*)"$`, "u").exec(text))) {
			let target = declare(match[1] ?? "").id;
			model.notes.push({
				id: `\u0000note${model.notes.length}`,
				lines: splitLines(match[2] ?? ""),
				target,
			});
			continue;
		}
		if ((match = /^note\s+"(.*)"$/.exec(text))) {
			model.notes.push({
				id: `\u0000note${model.notes.length}`,
				lines: splitLines(match[1] ?? ""),
			});
			continue;
		}
		if ((match = RELATION.exec(text))) {
			let start = headOf(match[3]);
			let end = headOf(match[5]);
			let parentAtEnd = end === "triangle" || end === "diamond" || end === "hollowDiamond";
			let parentAtStart = start === "triangle" || start === "diamond" || start === "hollowDiamond";
			model.relations.push({
				from: declare(match[1] ?? "").id,
				to: declare(match[7] ?? "").id,
				start,
				end,
				stroke: match[4] === ".." ? "dashed" : "solid",
				lines: match[8] ? splitLines(match[8]) : [],
				fromCardinality: match[2],
				toCardinality: match[6],
				upward: parentAtEnd && !parentAtStart,
			});
			continue;
		}
		if ((match = new RegExp(`^(${NAME})\\s*:\\s*(.+)$`, "u").exec(text))) {
			addMember(declare(match[1] ?? ""), match[2] ?? "");
			continue;
		}
		if (STYLING.test(text)) continue;
		throw new DiagramError(
			`Unknown class diagram statement "${text}"`,
			diagram.source,
			statement.index,
		);
	}

	if (body)
		throw new DiagramError(
			`Unclosed body of class "${body.box.id}"`,
			diagram.source,
			body.statement.index,
		);
	let open = namespaces.at(-1);
	if (open)
		throw new DiagramError(`Unclosed namespace "${open.id}"`, diagram.source, open.statement.index);
	return model;
}

/**
 * Files a member as a method when it has parentheses and as an attribute
 * otherwise, reading a trailing `$` as static and `*` as abstract.
 */
function addMember(box: ClassBox, raw: string): void {
	let text = raw.trim();
	let method = text.includes("(");
	let classifier = method ? /\)([$*])/.exec(text)?.[1] : undefined;
	if (!classifier) {
		let last = text.at(-1);
		if (last === "$" || last === "*") classifier = last;
	}
	let cleaned = classifier
		? text.replace(method ? /\)[$*]/ : /[$*]$/, method ? ")" : "").trim()
		: text;
	if (cleaned.endsWith("$") || cleaned.endsWith("*")) cleaned = cleaned.slice(0, -1).trim();
	let member = {
		text: generics(cleaned),
		isStatic: classifier === "$",
		isAbstract: classifier === "*",
	};
	if (method) box.methods.push(member);
	else box.attributes.push(member);
}

/** Mermaid's `~T~` generics as the angle brackets they stand for. */
function generics(text: string): string {
	let result = text;
	let previous = "";
	while (result !== previous) {
		previous = result;
		result = result.replace(/~([^~]*)~/, "<$1>");
	}
	return result;
}

/** The head a relation marker draws. */
function headOf(marker: string | undefined): Head {
	if (marker === "<|" || marker === "|>") return "triangle";
	if (marker === "*") return "diamond";
	if (marker === "o") return "hollowDiamond";
	if (marker === "<" || marker === ">") return "open";
	return "none";
}

/** The rows of a class box: header lines, then each compartment's members. */
interface Compartments {
	header: string[];
	headerHeight: number;
	attributesHeight: number;
	methodsHeight: number;
	width: number;
}

/** Measures a class box's three compartments. */
function measure(box: ClassBox): Compartments {
	let header = [...box.annotations.map((annotation) => `«${annotation}»`), box.name];
	let widths = [
		...box.annotations.map((annotation) => textWidth(`«${annotation}»`)),
		textWidth(box.name, { bold: true }),
		...[...box.attributes, ...box.methods].map((member) => textWidth(member.text)),
	];
	let compartment = (members: Member[]): number =>
		members.length === 0 ? PADDING : members.length * LINE_HEIGHT + PADDING * 2;
	return {
		header,
		headerHeight: header.length * LINE_HEIGHT + PADDING * 2,
		attributesHeight: compartment(box.attributes),
		methodsHeight: compartment(box.methods),
		width: Math.max(100, ...widths.map((width) => width + 24)),
	};
}

/** Lays the classes out and draws boxes, relations and notes. */
function draw(diagram: DiagramSource, model: Model): SvgElement {
	let measured = new Map([...model.classes.values()].map((box) => [box.id, measure(box)]));
	let nodes: CompoundNode[] = [...model.classes.values()].map((box) => {
		let size = measured.get(box.id) as Compartments;
		return {
			id: box.id,
			parent: box.parent,
			width: size.width,
			height: size.headerHeight + size.attributesHeight + size.methodsHeight,
		};
	});
	for (let note of model.notes) {
		let size = blockSize(note.lines);
		nodes.push({ id: note.id, width: size.width + 20, height: size.height + 14 });
	}
	let groups: CompoundGroup[] = [...model.namespaces].map(([id, parent]) => ({
		id,
		parent,
		header: { width: textWidth(id, { bold: true }) + 16, height: LINE_HEIGHT + 10 },
	}));

	let edges: GraphEdge[] = model.relations.map((relation) => {
		let edge: GraphEdge = relation.upward
			? { from: relation.to, to: relation.from }
			: { from: relation.from, to: relation.to };
		let label = relation.lines.length > 0 ? blockSize(relation.lines) : { width: 0, height: 0 };
		let room = relation.fromCardinality || relation.toCardinality ? CARDINALITY_ROOM : 0;
		let horizontal = model.direction === "LR" || model.direction === "RL";
		if (label.width > 0 || room > 0) {
			edge.label = horizontal
				? { width: label.width + room, height: label.height }
				: { width: label.width, height: label.height + room };
		}
		return edge;
	});
	let noteEdges = new Map<string, number>();
	for (let note of model.notes) {
		if (!note.target) continue;
		noteEdges.set(note.id, edges.length);
		edges.push({ from: note.id, to: note.target });
	}

	let layout = layoutCompound({
		direction: model.direction,
		nodes,
		groups,
		edges,
		nodeGap: 40,
		rankGap: 56,
	});

	let back: SvgNode[] = [];
	for (let [id, box] of layout.groups) {
		let top = box.y - box.height / 2;
		back.push(rect(box.x - box.width / 2, top, box.width, box.height, { style: TINT, radius: 4 }));
		back.push(label([id], box.x, top + 5 + LINE_HEIGHT / 2, { bold: true }));
	}

	let lines: SvgNode[] = [];
	let labels: SvgNode[] = [];
	for (let [index, relation] of model.relations.entries()) {
		let route = layout.edges[index];
		let fromBox = layout.nodes.get(relation.from);
		let toBox = layout.nodes.get(relation.to);
		if (!route || route.points.length < 2 || !fromBox || !toBox) continue;
		let points = relation.upward ? [...route.points].reverse() : [...route.points];
		points[0] = clip(fromBox, "rect", points[1] as Point);
		points[points.length - 1] = clip(toBox, "rect", points[points.length - 2] as Point);
		lines.push(...connector(points, relation.stroke, { start: relation.start, end: relation.end }));
		if (route.label) labels.push(...backedLabel(relation.lines, route.label));
		if (relation.fromCardinality)
			labels.push(cardinality(relation.fromCardinality, points[0] as Point, points[1] as Point));
		if (relation.toCardinality) {
			labels.push(
				cardinality(
					relation.toCardinality,
					points[points.length - 1] as Point,
					points[points.length - 2] as Point,
				),
			);
		}
	}
	for (let note of model.notes) {
		let route = layout.edges[noteEdges.get(note.id) ?? -1];
		let noteBox = layout.nodes.get(note.id);
		let target = note.target ? layout.nodes.get(note.target) : undefined;
		if (!note.target || !route || route.points.length < 2 || !noteBox || !target) continue;
		let points = [...route.points];
		points[0] = clip(noteBox, "rect", points[1] as Point);
		points[points.length - 1] = clip(target, "rect", points[points.length - 2] as Point);
		lines.push(...connector(points, "dashed"));
	}

	let shapes: SvgNode[] = [];
	for (let box of model.classes.values()) {
		let placed = layout.nodes.get(box.id);
		if (placed) shapes.push(drawClass(box, measured.get(box.id) as Compartments, placed));
	}
	for (let note of model.notes) {
		let placed = layout.nodes.get(note.id);
		if (!placed) continue;
		shapes.push(
			rect(placed.x - placed.width / 2, placed.y - placed.height / 2, placed.width, placed.height, {
				style: TINT,
			}),
		);
		shapes.push(label(note.lines, placed.x, placed.y));
	}

	return svgRoot(
		layout.width + 2 * MARGIN,
		layout.height + 2 * MARGIN,
		diagram.title ?? "Class diagram",
		diagram.description,
		[translate(MARGIN, MARGIN, [...back, ...lines, ...shapes, ...labels])],
	);
}

/** A class box: header centered, then attributes and methods left-aligned in their compartments. */
function drawClass(box: ClassBox, size: Compartments, placed: Box): SvgElement {
	let left = placed.x - placed.width / 2;
	let top = placed.y - placed.height / 2;
	let children: SvgNode[] = [rect(left, top, placed.width, placed.height, { style: BACKGROUND })];

	let y = top + PADDING + LINE_HEIGHT / 2;
	for (let [index, line] of size.header.entries()) {
		let isName = index === size.header.length - 1;
		children.push(label([line], placed.x, y, { bold: isName, italic: !isName }));
		y += LINE_HEIGHT;
	}

	let divider = (at: number): SvgElement =>
		element("path", {
			d: `M${num(left)} ${num(at)} H${num(left + placed.width)}`,
			...STROKE,
			fill: "none",
		});
	let compartment = (members: Member[], at: number): void => {
		children.push(divider(at));
		for (let [index, member] of members.entries()) {
			children.push(
				label([member.text], left + 10, at + PADDING + LINE_HEIGHT / 2 + index * LINE_HEIGHT, {
					anchor: "start",
					italic: member.isAbstract,
					underline: member.isStatic,
				}),
			);
		}
	};
	compartment(box.attributes, top + size.headerHeight);
	compartment(box.methods, top + size.headerHeight + size.attributesHeight);

	return element("g", {}, children);
}

/** A cardinality beside a line's end, set off to one side of it so the line stays visible. */
function cardinality(text: string, end: Point, next: Point): SvgElement {
	let length = distance(end, next) || 1;
	let ux = (next.x - end.x) / length;
	let uy = (next.y - end.y) / length;
	let along = 24;
	let across = textWidth(text) / 2 + 6;
	return label([unquote(text)], end.x + ux * along - uy * across, end.y + uy * along + ux * across);
}
