/**
 * The shape of a CI log before it is drawn: workflow markers (`##[group]`, `##[error]`…) read
 * off each line, groups nested into a tree, and the tree cut into chunks the browser can skip
 * painting. Shared by the server render and the island that appends streamed lines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnsiSpan, AnsiStyle } from "./ansi.js";

import { parseAnsiLine } from "./ansi.js";

/**
 * A line number no real log reaches, passed to a line-link builder so the link's shape can be
 * read back as a template, with `{n}` where the number goes, for lines that stream in later.
 */
export const LOG_LINE_PLACEHOLDER = 987_654_321;

/** How a line reads at a glance: an error or warning annotation, a command echo, or plain output. */
export type LogTone = "danger" | "warning" | "notice" | "command" | "muted";

/** One line of a step's log as the server holds it. */
export interface LogLine {
	/** The line's number within its step, starting at 1. */
	n: number;
	/** The raw text, ANSI escapes and workflow markers included. */
	text: string;
	/** When the line was written, as ISO 8601. */
	ts?: string;
	/** Marks the line as opening or closing a fold, for logs that carry no `##[group]` markers. */
	group?: "start" | "end";
}

/** A line read for drawing: its marker removed, its tone set and its text split into ANSI spans. */
export interface LogEntry {
	n: number;
	spans: AnsiSpan[];
	ts?: string;
	tone?: LogTone;
}

/** A node of the drawn tree: a line, or a fold whose title line opens it. */
export type LogNode =
	| { kind: "line"; entry: LogEntry }
	| { kind: "group"; entry: LogEntry; children: LogNode[]; lines: number; hasError: boolean };

/** What a line's leading workflow marker makes it. */
export type LogMarker = "group" | "endgroup" | LogTone | undefined;

/** The workflow markers a line may start with, and what each makes it. */
const MARKERS: Record<string, Exclude<LogMarker, undefined>> = {
	group: "group",
	endgroup: "endgroup",
	error: "danger",
	warning: "warning",
	notice: "notice",
	command: "command",
	debug: "muted",
};

/** `##[name]` at the start of a line, after any escapes that precede it. */
// oxlint-disable-next-line no-control-regex -- a marker may follow the ESC sequences that colour it
const MARKER = /^((?:\u001b\[[0-9;]*m)*)##\[(\w+)\]/;

/** An ISO 8601 timestamp and the space after it, the way raw CI logs prefix every line. */
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z) /;

/**
 * Reads a line's leading workflow marker, returning it with the marker removed from the text.
 *
 * @param text The raw line.
 * @returns The marker (or `undefined`) and the text to draw.
 * @example readMarker("##[error]Process completed with exit code 1.") // { marker: "danger", text: "Process completed…" }
 */
export function readMarker(text: string): { marker: LogMarker; text: string } {
	let match = MARKER.exec(text);
	let marker = match === null ? undefined : MARKERS[match[2]!.toLowerCase()];
	if (match === null || marker === undefined) return { marker: undefined, text };
	return { marker, text: match[1]! + text.slice(match[0].length) };
}

/**
 * Splits a raw streamed line into its ISO timestamp and the text after it.
 *
 * @param raw A line as a CI runner writes it.
 * @returns The timestamp, when the line starts with one, and the text.
 * @example splitTimestamp("2026-11-13T09:00:01.123Z Run tests") // { ts: "2026-11-13T09:00:01.123Z", text: "Run tests" }
 */
export function splitTimestamp(raw: string): { ts?: string; text: string } {
	let match = TIMESTAMP.exec(raw);
	return match === null ? { text: raw } : { ts: match[1]!, text: raw.slice(match[0].length) };
}

/**
 * The time a line shows: an ISO timestamp as `HH:MM:SS` UTC, anything else as given, so the
 * server's lines and streamed ones read alike.
 *
 * @param ts The line's timestamp.
 * @returns The time to draw beside the line.
 * @example formatLogTime("2026-11-13T09:00:01.123Z") // "09:00:01"
 */
export function formatLogTime(ts: string): string {
	return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(ts) ? ts.slice(11, 19) : ts;
}

/** What a line makes of the log: its explicit `group` field wins over its text's marker. */
function lineKind(line: LogLine, marker: LogMarker): LogMarker {
	if (line.group === "start") return "group";
	if (line.group === "end") return "endgroup";
	return marker;
}

/**
 * Nests a step's lines into folds: a `##[group]` line (or `group: "start"`) opens a fold
 * titled by its text, `##[endgroup]` (or `group: "end"`) closes the innermost one and is not
 * drawn, and a fold still open at the end closes there.
 *
 * @param lines The step's lines in order.
 * @returns The top-level nodes.
 * @example buildLogTree([{ n: 1, text: "##[group]Install" }, { n: 2, text: "ok" }, { n: 3, text: "##[endgroup]" }])
 */
export function buildLogTree(lines: readonly LogLine[]): LogNode[] {
	let root: LogNode[] = [];
	let stack: Extract<LogNode, { kind: "group" }>[] = [];
	let siblings = () => stack.at(-1)?.children ?? root;
	let style: AnsiStyle = {};

	for (let line of lines) {
		let { marker, text } = readMarker(line.text);
		let kind = lineKind(line, marker);
		let parsed = parseAnsiLine(text, style);
		style = parsed.state;
		if (kind === "endgroup") {
			stack.pop();
			continue;
		}
		let entry: LogEntry = { n: line.n, spans: parsed.spans, ts: line.ts };
		if (kind !== undefined && kind !== "group") entry.tone = kind;
		for (let open of stack) open.lines++;
		if (kind === "group") {
			let group: Extract<LogNode, { kind: "group" }> = {
				kind: "group",
				entry,
				children: [],
				lines: 1,
				hasError: false,
			};
			siblings().push(group);
			stack.push(group);
			continue;
		}
		if (entry.tone === "danger") for (let open of stack) open.hasError = true;
		siblings().push({ kind: "line", entry });
	}
	return root;
}

/**
 * Cuts sibling nodes into runs of about `size` lines, a fold counting all of its lines, so
 * each run can be skipped as one box while off screen. A fold is never split.
 *
 * @param nodes Sibling nodes in order.
 * @param size The lines a run aims for.
 * @returns The runs, in order.
 * @example chunkLogNodes(buildLogTree(lines), 200)
 */
export function chunkLogNodes(nodes: readonly LogNode[], size: number): LogNode[][] {
	let chunks: LogNode[][] = [];
	let current: LogNode[] = [];
	let weight = 0;
	for (let node of nodes) {
		current.push(node);
		weight += node.kind === "group" ? node.lines : 1;
		if (weight >= size) {
			chunks.push(current);
			current = [];
			weight = 0;
		}
	}
	if (current.length > 0) chunks.push(current);
	return chunks;
}

/**
 * The attributes a styled span carries, which the viewer's stylesheet tones; the same names
 * serve the server's markup and the lines the island appends.
 *
 * @param style The span's ANSI style.
 * @returns `data-fg`, `data-bg`, `data-b`, `data-dim`, `data-i` and `data-u`, where set.
 * @example ansiAttributes({ fg: "red", bold: true }) // { "data-fg": "red", "data-b": "" }
 */
export function ansiAttributes(style: AnsiStyle): Record<string, string> {
	let attributes: Record<string, string> = {};
	if (style.fg !== undefined) attributes["data-fg"] = style.fg;
	if (style.bg !== undefined) attributes["data-bg"] = style.bg;
	if (style.bold) attributes["data-b"] = "";
	if (style.dim) attributes["data-dim"] = "";
	if (style.italic) attributes["data-i"] = "";
	if (style.underline) attributes["data-u"] = "";
	return attributes;
}
