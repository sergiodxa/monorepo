/**
 * Turns the text of a `/** … *\/` block into prose plus block tags. The split
 * respects fenced code, so an `@example` may contain a nested JSDoc comment
 * without its tags escaping into the enclosing block.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocComment, DocTag } from "./types.js";

/**
 * Spellings that mean the same thing as another tag, collapsed so a renderer
 * matches one name per concept instead of every alias an author might write.
 */
const TAG_ALIASES: Record<string, string> = {
	arg: "param",
	argument: "param",
	desc: "description",
	defaultValue: "default",
	exception: "throws",
	prop: "property",
	return: "returns",
	typeparam: "template",
	typeParam: "template",
	typeParameter: "template",
	yield: "yields",
};

/**
 * Canonical tags whose first word is the subject they document rather than the
 * start of their description.
 */
const NAMED_TAGS = new Set(["param", "property", "template", "typedef", "callback"]);

/**
 * Parse one JSDoc block into its description and block tags.
 *
 * Accepts the comment with or without its `/**` and `*\/` markers, and tolerates
 * the leading `*` on continuation lines.
 *
 * @param raw - Text of a single JSDoc comment.
 * @returns The prose before the first block tag, then every tag in source order.
 *
 * @example
 * let comment = parseComment("/** Adds two numbers.\n * @param a - The addend.\n *\/");
 * comment.tags[0].name; // "a"
 */
export function parseComment(raw: string): DocComment {
	let blocks = splitBlocks(commentLines(raw));
	let [description] = blocks;
	return {
		description: (description ?? []).join("\n").trim(),
		tags: blocks.slice(1).map(parseTag),
	};
}

/**
 * Strip the comment markers and the per-line `*` gutter, keeping the relative
 * indentation that fenced code inside an `@example` depends on.
 */
function commentLines(raw: string): string[] {
	let text = raw.trim();
	if (text.startsWith("/**")) text = text.slice(3);
	else if (text.startsWith("/*")) text = text.slice(2);
	if (text.endsWith("*/")) text = text.slice(0, -2);
	return text.split("\n").map((line) => line.replace(/^[ \t]*\*? ?/, "").trimEnd());
}

/**
 * Cut the lines at every block tag that starts a line outside a fenced code
 * block, so the first group is the description and each later group is one tag.
 */
function splitBlocks(lines: string[]): string[][] {
	let blocks: string[][] = [[]];
	let fence: string | null = null;

	for (let line of lines) {
		let fenced = /^\s*(```+|~~~+)/.exec(line);
		if (fenced?.[1]) {
			if (fence === null) fence = fenced[1][0] ?? null;
			else if (fenced[1].startsWith(fence)) fence = null;
		}

		if (fence === null && /^@\S/.test(line)) blocks.push([line]);
		else blocks.at(-1)?.push(line);
	}

	return blocks;
}

/** Read one tag group into its canonical name, optional type, subject and text. */
function parseTag(lines: string[]): DocTag {
	let [first = "", ...rest] = lines;
	let match = /^@(\S+)[ \t]*/.exec(first);
	let tag = canonicalTag(match?.[1] ?? "");
	let remainder = first.slice(match?.[0].length ?? 0);

	let braced = readBraced(remainder);
	let type = braced?.value ?? null;
	if (braced) remainder = braced.rest.replace(/^[ \t]*/, "");

	let name: string | null = null;
	if (NAMED_TAGS.has(tag)) {
		let word = /^(\S+)[ \t]*/.exec(remainder);
		if (word?.[1]) {
			name = unwrapOptional(word[1]);
			remainder = remainder.slice(word[0].length);
		}
	}

	let text = [remainder.replace(/^-[ \t]*/, ""), ...rest].join("\n").trim();
	return { tag, name, type, text };
}

/** Map an alias onto the spelling the model exposes. */
function canonicalTag(tag: string): string {
	return TAG_ALIASES[tag] ?? tag;
}

/**
 * Read a leading `{…}` annotation, counting nested braces so a type such as
 * `{{ id: string }}` survives. An inline `{@link …}` is description text, not a
 * type, so it is left where it is.
 */
function readBraced(text: string): { value: string; rest: string } | null {
	if (!text.startsWith("{") || text.startsWith("{@")) return null;

	let depth = 0;
	for (let index = 0; index < text.length; index++) {
		if (text[index] === "{") depth++;
		else if (text[index] === "}") {
			depth--;
			if (depth === 0) return { value: text.slice(1, index), rest: text.slice(index + 1) };
		}
	}

	return null;
}

/**
 * Unwrap the Closure optional syntax so `[options]` and `[count=0]` both name
 * the parameter they document, which is what matches it to a signature.
 */
function unwrapOptional(word: string): string {
	let match = /^\[([^=\]]+)(?:=[^\]]*)?\]$/.exec(word);
	return match?.[1]?.trim() ?? word;
}
