/**
 * A small parser for the ANSI SGR escapes CI logs colour their lines with: it splits a line
 * into runs of text, each with the colour and weight in force, and drops every other escape
 * (cursor moves, erases, OSC titles), so a log renders as styled text without terminal noise.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The eight terminal colours; bright variants fold into their base colour. */
export type AnsiColor =
	| "black"
	| "red"
	| "green"
	| "yellow"
	| "blue"
	| "magenta"
	| "cyan"
	| "white";

/** The SGR attributes in force at a point in the text. */
export interface AnsiStyle {
	fg?: AnsiColor;
	bg?: AnsiColor;
	bold?: boolean;
	dim?: boolean;
	italic?: boolean;
	underline?: boolean;
}

/** One run of text and the style it is drawn in. */
export interface AnsiSpan extends AnsiStyle {
	text: string;
}

/** A parsed line and the style still in force at its end, which the next line starts from. */
export interface AnsiLine {
	spans: AnsiSpan[];
	state: AnsiStyle;
}

/** Colour names by SGR offset: 30–37 and 90–97 for the foreground, 40–47 and 100–107 behind it. */
const COLORS: readonly AnsiColor[] = [
	"black",
	"red",
	"green",
	"yellow",
	"blue",
	"magenta",
	"cyan",
	"white",
];

/**
 * Every escape a terminal log carries: CSI sequences (`ESC [ … final`), OSC strings ended by
 * BEL or `ESC \`, and two-character escapes. Only CSI `m` (SGR) changes the style.
 */
// oxlint-disable-next-line no-control-regex -- every terminal escape starts with the ESC control character
const ESCAPE = /\u001b(?:\[([0-9;:?]*)([@-~])|\][^\u0007\u001b]*(?:\u0007|\u001b\\)|[@-Z\\-_])/g;

/** The named colour for a 256-colour index, for the 16 indices that have one. */
function indexedColor(index: number): AnsiColor | undefined {
	if (index >= 0 && index < 8) return COLORS[index];
	if (index >= 8 && index < 16) return COLORS[index - 8];
	return undefined;
}

/**
 * Applies one SGR parameter list to `style`. Extended colours (`38;5;n`, `38;2;r;g;b`) consume
 * their arguments; an index under 16 maps to its named colour and the rest leave it unset.
 */
function applySgr(style: AnsiStyle, params: string): AnsiStyle {
	let codes = params === "" ? [0] : params.split(/[;:]/).map((code) => Number(code || "0"));
	let next = { ...style };
	for (let index = 0; index < codes.length; index++) {
		let code = codes[index]!;
		if (code === 0) next = {};
		else if (code === 1) next.bold = true;
		else if (code === 2) next.dim = true;
		else if (code === 3) next.italic = true;
		else if (code === 4) next.underline = true;
		else if (code === 22) {
			delete next.bold;
			delete next.dim;
		} else if (code === 23) delete next.italic;
		else if (code === 24) delete next.underline;
		else if (code >= 30 && code <= 37) next.fg = COLORS[code - 30];
		else if (code >= 90 && code <= 97) next.fg = COLORS[code - 90];
		else if (code === 39) delete next.fg;
		else if (code >= 40 && code <= 47) next.bg = COLORS[code - 40];
		else if (code >= 100 && code <= 107) next.bg = COLORS[code - 100];
		else if (code === 49) delete next.bg;
		else if (code === 38 || code === 48) {
			let mode = codes[index + 1];
			let color: AnsiColor | undefined;
			if (mode === 5) {
				color = indexedColor(codes[index + 2] ?? -1);
				index += 2;
			} else if (mode === 2) {
				index += 4;
			}
			let key: "fg" | "bg" = code === 38 ? "fg" : "bg";
			if (color === undefined) delete next[key];
			else next[key] = color;
		}
	}
	return next;
}

/** Whether two styles draw the same, an unset flag counting as off. */
function sameStyle(a: AnsiStyle, b: AnsiStyle): boolean {
	return (
		a.fg === b.fg &&
		a.bg === b.bg &&
		Boolean(a.bold) === Boolean(b.bold) &&
		Boolean(a.dim) === Boolean(b.dim) &&
		Boolean(a.italic) === Boolean(b.italic) &&
		Boolean(a.underline) === Boolean(b.underline)
	);
}

/**
 * Parses one line, starting from the style the previous line left in force. Adjacent runs in
 * the same style merge, and a line with no escapes comes back as one unstyled span.
 *
 * @param text The raw line, escapes included.
 * @param state The style in force at the line's start. @default {}
 * @returns The line's spans and the style in force at its end.
 * @example parseAnsiLine("\u001b[31merror\u001b[0m: failed") // spans: [{ text: "error", fg: "red" }, { text: ": failed" }]
 */
export function parseAnsiLine(text: string, state: AnsiStyle = {}): AnsiLine {
	let spans: AnsiSpan[] = [];
	let style = state;
	let at = 0;
	let push = (chunk: string) => {
		if (chunk === "") return;
		let last = spans.at(-1);
		if (last !== undefined && sameStyle(last, style)) last.text += chunk;
		else spans.push({ ...style, text: chunk });
	};
	for (let match of text.matchAll(ESCAPE)) {
		push(text.slice(at, match.index));
		at = match.index + match[0].length;
		if (match[2] === "m") style = applySgr(style, match[1] ?? "");
	}
	push(text.slice(at));
	return { spans, state: style };
}

/**
 * Parses a whole block of text, line by line with the style carried across lines, into one
 * list of spans per line.
 *
 * @param text Raw log text, lines separated by `\n`.
 * @returns The spans of each line, in order.
 * @example parseAnsi("\u001b[1mBuild\u001b[0m\nok").length // 2
 */
export function parseAnsi(text: string): AnsiSpan[][] {
	let state: AnsiStyle = {};
	return text.split("\n").map((line) => {
		let parsed = parseAnsiLine(line, state);
		state = parsed.state;
		return parsed.spans;
	});
}

/**
 * Removes every escape from a line, leaving the text a reader sees.
 *
 * @param text The raw line.
 * @returns The text without escapes.
 * @example stripAnsi("\u001b[32mok\u001b[0m") // "ok"
 */
export function stripAnsi(text: string): string {
	return text.replace(ESCAPE, "");
}
