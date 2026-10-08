/**
 * A `Markdown.walk` visitor that sets prose in typographic punctuation: curly quotes
 * and apostrophes, en and em dashes, and the ellipsis. Only `text` nodes change, so
 * code, raw HTML and attribute values keep the ASCII their syntax depends on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Markdown } from "../index.js";

/** The opening and closing mark of one quote level. */
export type QuotePair = readonly [open: string, close: string];

/** Which rules run, and the quote marks a locale writes. */
export interface TypographyOptions {
	/**
	 * Curls `"` and `'`; an object sets the marks each level opens and closes with.
	 * An apostrophe is always `’`, whatever the locale's single quotes are.
	 * @default true
	 */
	quotes?: boolean | { double?: QuotePair; single?: QuotePair };
	/**
	 * Turns `---` into an em dash and `--` into an en dash.
	 * @default true
	 */
	dashes?: boolean;
	/**
	 * Turns `...` into an ellipsis.
	 * @default true
	 */
	ellipses?: boolean;
}

/** English double quotes, used when the options name no other. */
const DOUBLE_QUOTES: QuotePair = ["“", "”"];

/** English single quotes, used when the options name no other. */
const SINGLE_QUOTES: QuotePair = ["‘", "’"];

/** The mark a contraction, a possessive or an elided year is written with. */
const APOSTROPHE = "’";

/** Characters after which a quote opens, besides whitespace, the start and an opening quote. */
const OPENERS = new Set(["(", "[", "{", "<", "-", "–", "—", "/"]);

/** A letter or a digit, which is what joins a contraction into one word. */
const WORD = /[\p{L}\p{N}]/u;

/** An elided year, `'90s`, as read after the apostrophe. */
const ELIDED_YEAR = /^\d\d(?![\d'])/;

/** Parents whose children are always inline content. */
const INLINE_PARENTS = new Set<string>([
	"paragraph",
	"heading",
	"tableCell",
	"emphasis",
	"strong",
	"strikethrough",
	"link",
	"image",
]);

/** Node types that only ever stand in an inline slot, so a tag or element holding one holds inline content. */
const INLINE_ONLY = new Set<string>([
	...INLINE_PARENTS,
	"text",
	"inlineCode",
	"softBreak",
	"hardBreak",
	"inlineHtml",
	"footnoteReference",
	"variable",
]);

/** Elements whose text is code or keyboard input, which reads as typed and is kept as written. */
const CODE_ELEMENTS = new Set<string>(["code", "kbd", "samp", "var"]);

/** One stretch of an inline run: a text node to set, or the characters of a node that only lends context. */
interface Segment {
	text?: Markdown.Text;
	value: string;
}

/** The nodes that can open an inline run. */
type RunRoot =
	| Markdown.Paragraph
	| Markdown.Heading
	| Markdown.TableCell
	| Markdown.Tag
	| Markdown.Element;

/**
 * Builds the visitor. Each paragraph, heading, table cell, or block-level tag or
 * element holding inline content is set as one run, so a quote is decided by the
 * characters around it even when they sit in a sibling or a nested node. A run ends
 * at its block, so a quote opened in one paragraph and closed in the next is set
 * by each paragraph's own characters. A text node with nothing to change, and every
 * block holding none, is handed back as the same object.
 *
 * @param options - Which rules run, and the locale's quote marks
 * @returns A visitor to pass to `Markdown.walk`, alone or spread beside others
 * @example Markdown.walk(document, typography({ quotes: { double: ["«", "»"], single: ["‹", "›"] } }))
 */
export function typography(options: TypographyOptions = {}) {
	let { quotes = true, dashes = true, ellipses = true } = options;
	let double = (typeof quotes === "object" && quotes.double) || DOUBLE_QUOTES;
	let single = (typeof quotes === "object" && quotes.single) || SINGLE_QUOTES;
	let openers = new Set([...OPENERS, "“", "‘", lastOf(double[0]), lastOf(single[0])]);

	/** Dashes and ellipses, which depend on nothing outside the text itself. */
	function punctuate(value: string): string {
		let set = value;
		if (dashes) set = set.replaceAll("---", "—").replaceAll("--", "–");
		if (ellipses) set = set.replaceAll("...", "…");
		return set;
	}

	/**
	 * The mark a straight quote becomes. It opens after whitespace, the start of the
	 * run, a bracket, a dash or another opening quote, when something follows it;
	 * otherwise it closes. A `'` inside a word or ahead of an elided year is an apostrophe.
	 */
	function curl(quote: string, previous: string, rest: string): string {
		let next = rest.charAt(0);
		if (quote === "'") {
			if (WORD.test(previous) && WORD.test(next)) return APOSTROPHE;
			if (!WORD.test(previous) && ELIDED_YEAR.test(rest)) return APOSTROPHE;
		}
		let [open, close] = quote === '"' ? double : single;
		let opensAfter = previous === "" || /\s/.test(previous) || openers.has(previous);
		return opensAfter && next !== "" && !/\s/.test(next) ? open : close;
	}

	/** The run's text nodes, each set with the whole run as context; only changed ones are in the map. */
	function setSegments(segments: Segment[]): Map<Markdown.Text, Markdown.Text> {
		let values = segments.map((segment) =>
			segment.text ? punctuate(segment.value) : segment.value,
		);
		let stream = values.join("");
		let previous = "";
		let offset = 0;
		let replaced = new Map<Markdown.Text, Markdown.Text>();

		for (let [index, segment] of segments.entries()) {
			let value = values[index] ?? "";
			let set = "";
			for (let char of value) {
				offset += char.length;
				let mark =
					segment.text && quotes && (char === '"' || char === "'")
						? curl(char, previous, stream.slice(offset, offset + 3))
						: char;
				set += mark;
				previous = lastOf(mark) || previous;
			}
			if (segment.text && set !== segment.value) {
				replaced.set(segment.text, { ...segment.text, value: set });
			}
		}

		return replaced;
	}

	/** Sets one run, or leaves it to the ancestor whose run already covers it. */
	function setRun<N extends RunRoot>(node: N, parent: Markdown.Parent | null): N | undefined {
		if (!holdsInline(node) || isCode(node)) return undefined;
		if (parent && holdsInline(parent)) return undefined;

		let segments: Segment[] = [];
		collect(node.children, segments);
		let replaced = setSegments(segments);
		if (replaced.size === 0) return undefined;
		return rebuild(node, replaced);
	}

	return {
		paragraph: setRun,
		heading: setRun,
		tableCell: setRun,
		tag: setRun,
		element: setRun,
	} satisfies Markdown.Visitor;
}

/**
 * Flattens an inline subtree into the run's segments. Code lends its characters,
 * a break reads as whitespace, a variable or footnote reference as a word, and raw
 * HTML and comments lend nothing, so the characters around them meet.
 */
function collect(nodes: Markdown.Node[], segments: Segment[]): void {
	for (let node of nodes) {
		if (node.type === "text") segments.push({ text: node, value: node.value });
		else if (node.type === "inlineCode") segments.push({ value: node.value });
		else if (node.type === "softBreak" || node.type === "hardBreak") segments.push({ value: "\n" });
		else if (node.type === "variable" || node.type === "footnoteReference") {
			segments.push({ value: "x" });
		} else if (isCode(node)) segments.push({ value: "x" });
		else if ("children" in node) collect(node.children, segments);
	}
}

/** The node with every replaced text node swapped in, sharing each subtree that holds none. */
function rebuild<N extends Markdown.Node>(node: N, replaced: Map<Markdown.Text, Markdown.Text>): N {
	if (node.type === "text") return (replaced.get(node) ?? node) as N;
	if (!("children" in node)) return node;

	let children: Markdown.Node[] = node.children;
	let rebuilt = children.map((child) => rebuild(child, replaced));
	if (rebuilt.every((child, index) => child === children[index])) return node;
	return { ...node, children: rebuilt };
}

/** Whether a node's children are inline content, which a tag or element decides by what it holds. */
function holdsInline(node: Markdown.Node): boolean {
	if (INLINE_PARENTS.has(node.type)) return true;
	if (node.type !== "tag" && node.type !== "element") return false;
	return node.children.some((child) => INLINE_ONLY.has(child.type));
}

/** An element whose text is code, which the run reads as one word and leaves as written. */
function isCode(node: Markdown.Node): boolean {
	return node.type === "element" && CODE_ELEMENTS.has(node.name);
}

/** The last character of a string, or an empty string for an empty one. */
function lastOf(value: string): string {
	return value.slice(-1);
}
