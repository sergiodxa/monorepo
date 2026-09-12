/**
 * CommonMark's seven kinds of HTML block, as the conditions that open one and the
 * conditions that end it. They live together because a block remembers which kind
 * it is for exactly as long as it takes to recognize its own end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The element names CommonMark treats as block-level for the sixth condition. */
const BLOCK_NAMES =
	"address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";

const TAG_NAME = "[A-Za-z][A-Za-z0-9-]*";
const ATTRIBUTE_NAME = "[a-zA-Z_:][a-zA-Z0-9:._-]*";
const ATTRIBUTE_VALUE = "(?:[^\"'=<>`\\x00-\\x20]+|'[^']*'|\"[^\"]*\")";
const ATTRIBUTE = `(?:\\s+${ATTRIBUTE_NAME}(?:\\s*=\\s*${ATTRIBUTE_VALUE})?)`;
const OPEN_TAG = `<${TAG_NAME}${ATTRIBUTE}*\\s*/?>`;
const CLOSE_TAG = `</${TAG_NAME}\\s*>`;

/** Indexed by kind, so a matched index is the kind itself. Index zero never matches. */
const OPEN_CONDITIONS = [
	/(?!)/,
	/^<(?:script|pre|textarea|style)(?:\s|>|$)/i,
	/^<!--/,
	/^<[?]/,
	/^<![A-Za-z]/,
	/^<!\[CDATA\[/,
	new RegExp(`^</?(?:${BLOCK_NAMES})(?:\\s|/?>|$)`, "i"),
	new RegExp(`^(?:${OPEN_TAG}|${CLOSE_TAG})\\s*$`, "i"),
];

/** The first five kinds end on a marker; the last two end on a blank line instead. */
const CLOSE_CONDITIONS = [/(?!)/, /<\/(?:script|pre|textarea|style)>/i, /-->/, /\?>/, />/, /\]\]>/];

/**
 * The kind of HTML block a line opens. The seventh kind cannot interrupt a
 * paragraph, which is what keeps a line of prose beginning with an element from
 * swallowing the paragraph it belongs to.
 *
 * @param text - The line's text from its first non-space character
 * @param interrupting - Whether an open paragraph would have to be closed
 * @returns The kind, or `null` when the line opens no HTML block
 */
export function readHtmlBlockKind(text: string, interrupting: boolean): number | null {
	for (let kind = 1; kind < OPEN_CONDITIONS.length; kind++) {
		if (kind === 7 && interrupting) continue;
		if (OPEN_CONDITIONS[kind]?.test(text)) return kind;
	}

	return null;
}

/**
 * Whether a line carries the marker its block ends on. The sixth and seventh
 * kinds end at a blank line instead, so they never answer yes here.
 *
 * @param kind - The kind the block was opened as
 * @param text - The line's text
 * @returns Whether the block ends with this line included
 */
export function closesHtmlBlock(kind: number, text: string): boolean {
	return CLOSE_CONDITIONS[kind]?.test(text) ?? false;
}
