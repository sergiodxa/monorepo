/**
 * Text styling for terminal output: colours and weights as ANSI SGR sequences, decided once per
 * stream, so the same handler writes styled text to a terminal and plain text to a pipe or a
 * file. Also measures text as a terminal lays it out, which redrawing depends on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The environment variables the colour decision reads. */
export type Env = Readonly<Record<string, string | undefined>>;

/** Wraps text in one ANSI style, or answers it unchanged when styling is off. */
export type Paint = (text: string) => string;

/** The styles a command writes with; every one answers its input unchanged when `enabled` is false. */
export interface Style {
	/** Whether this stream receives ANSI sequences. */
	readonly enabled: boolean;
	readonly bold: Paint;
	readonly dim: Paint;
	readonly italic: Paint;
	readonly underline: Paint;
	readonly inverse: Paint;
	readonly red: Paint;
	readonly green: Paint;
	readonly yellow: Paint;
	readonly blue: Paint;
	readonly magenta: Paint;
	readonly cyan: Paint;
	readonly gray: Paint;
}

/** Each style's opening and closing SGR codes; closing codes reset only what they opened. */
const CODES: Readonly<Record<Exclude<keyof Style, "enabled">, readonly [number, number]>> = {
	bold: [1, 22],
	dim: [2, 22],
	italic: [3, 23],
	underline: [4, 24],
	inverse: [7, 27],
	red: [31, 39],
	green: [32, 39],
	yellow: [33, 39],
	blue: [34, 39],
	magenta: [35, 39],
	cyan: [36, 39],
	gray: [90, 39],
};

/** Every ANSI escape sequence this package or a child process may write: SGR, cursor and erase. */
// oxlint-disable-next-line eslint/no-control-regex -- ANSI sequences start with the ESC control character
const ANSI_SEQUENCE = /\u001B\[[0-9;?]*[A-Za-z]/g;

/**
 * A style set. Nested styles keep the outer one: closing an inner colour re-opens the colour
 * around it, so `red(\`a ${bold("b")} c\`)` stays red after the bold part.
 */
export function createStyle(enabled: boolean): Style {
	let entries = Object.entries(CODES).map(([name, [open, close]]) => {
		let openCode = `\u001B[${open}m`;
		let closeCode = `\u001B[${close}m`;
		let paint: Paint = enabled
			? (text) => `${openCode}${text.split(closeCode).join(`${closeCode}${openCode}`)}${closeCode}`
			: (text) => text;
		return [name, paint] as const;
	});
	return { enabled, ...Object.fromEntries(entries) } as Style;
}

/**
 * Whether a stream receives colour: `FORCE_COLOR` (other than `0`) turns it on, `NO_COLOR` or
 * `TERM=dumb` turns it off, and otherwise it follows whether the stream is a terminal.
 */
export function colorEnabled(stream: { isTTY?: boolean }, env: Env): boolean {
	let force = env.FORCE_COLOR;
	if (force !== undefined) return force !== "0" && force !== "false";
	if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") return false;
	if (env.TERM === "dumb") return false;
	return stream.isTTY === true;
}

/** `text` without ANSI escape sequences. */
export function stripStyle(text: string): string {
	return text.replace(ANSI_SEQUENCE, "");
}

/** Splits text into user-perceived characters, so an emoji with modifiers is one character. */
const SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** `text` as user-perceived characters, the unit a line editor moves and deletes by. */
export function graphemes(text: string): string[] {
	return Array.from(SEGMENTER.segment(text), (segment) => segment.segment);
}

/**
 * How many terminal columns `text` occupies: ANSI sequences take none, and each user-perceived
 * character takes one, so East Asian wide characters and emoji count as one column.
 */
export function visibleWidth(text: string): number {
	return graphemes(stripStyle(text)).length;
}
