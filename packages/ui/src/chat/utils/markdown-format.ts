/**
 * The Markdown edits a chat composer's formatting controls make: wrapping a selection in
 * inline markers, a code fence or a link, and prefixing lines as a quote or a list. Pure
 * text in, text and selection out, so every edit is testable without a field.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A Markdown edit a composer's formatting controls offer and {@link applyFormat} performs. */
export type FormatAction = "bold" | "italic" | "strike" | "code" | "link" | "quote" | "list";

/** A field's text after a format, with the range to select in it. */
export interface FormattedText {
	value: string;
	start: number;
	end: number;
}

/** The marker each inline action writes on both sides of the selection. */
const INLINE_MARKERS = { bold: "**", italic: "_", strike: "~~", code: "`" } as const;

/** The prefix each line action writes at the start of every selected line. */
const LINE_PREFIXES = { quote: "> ", list: "- " } as const;

/** The fence a multi-line code selection is wrapped in. */
const FENCE = "```";

/** The placeholder a new link points to, selected so typing replaces it. */
const LINK_PLACEHOLDER = "url";

/**
 * Applies a Markdown format to `start`–`end` of `value`. Applying an action to text it already
 * formats removes the format, so each button toggles; an empty selection writes the markers
 * with the caret between them.
 *
 * @param value The field's text.
 * @param start The selection's start.
 * @param end The selection's end.
 * @param action The format to apply.
 * @returns The new text and the range to select in it.
 * @example applyFormat("hi there", 3, 8, "bold") // { value: "hi **there**", start: 5, end: 10 }
 * @example applyFormat("a\nb", 0, 3, "list") // { value: "- a\n- b", start: 0, end: 7 }
 */
export function applyFormat(
	value: string,
	start: number,
	end: number,
	action: FormatAction,
): FormattedText {
	let from = Math.max(0, Math.min(start, end, value.length));
	let to = Math.min(value.length, Math.max(start, end));
	if (action === "quote" || action === "list") {
		return prefixLines(value, from, to, LINE_PREFIXES[action]);
	}
	if (action === "link") return link(value, from, to);
	if (action === "code" && value.slice(from, to).trimEnd().includes("\n")) {
		return fence(value, from, to);
	}
	return wrap(value, from, to, INLINE_MARKERS[action]);
}

/**
 * Wraps the selection in `marker`, or unwraps it when the markers already sit inside or just
 * outside it. Whitespace at the selection's edges stays outside the markers, where Markdown
 * expects it.
 */
function wrap(value: string, start: number, end: number, marker: string): FormattedText {
	let size = marker.length;
	let selected = value.slice(start, end);
	if (selected.length >= size * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
		let inner = selected.slice(size, -size);
		return {
			value: value.slice(0, start) + inner + value.slice(end),
			start,
			end: start + inner.length,
		};
	}
	if (
		start >= size &&
		value.slice(start - size, start) === marker &&
		value.slice(end, end + size) === marker
	) {
		return {
			value: value.slice(0, start - size) + selected + value.slice(end + size),
			start: start - size,
			end: end - size,
		};
	}
	let core = selected.trim();
	let from = core === "" ? start : start + selected.indexOf(core);
	let to = core === "" ? end : from + core.length;
	return {
		value: value.slice(0, from) + marker + value.slice(from, to) + marker + value.slice(to),
		start: from + size,
		end: to + size,
	};
}

/**
 * Wraps a multi-line selection in a code fence on lines of its own, or removes the fence
 * the selection is already wrapped in.
 */
function fence(value: string, start: number, end: number): FormattedText {
	let to = value.slice(start, end).endsWith("\n") ? end - 1 : end;
	let selected = value.slice(start, to);
	let open = `${FENCE}\n`;
	let close = `\n${FENCE}`;
	if (selected.startsWith(open) && selected.endsWith(close) && selected.length >= 8) {
		let inner = selected.slice(open.length, -close.length);
		return {
			value: value.slice(0, start) + inner + value.slice(to),
			start,
			end: start + inner.length,
		};
	}
	if (
		value.slice(start - open.length, start) === open &&
		value.slice(to, to + close.length) === close
	) {
		return {
			value: value.slice(0, start - open.length) + selected + value.slice(to + close.length),
			start: start - open.length,
			end: to - open.length,
		};
	}
	let before = start > 0 && value[start - 1] !== "\n" ? `\n${open}` : open;
	let after = to < value.length && value[to] !== "\n" ? `${close}\n` : close;
	return {
		value: value.slice(0, start) + before + selected + after + value.slice(to),
		start: start + before.length,
		end: start + before.length + selected.length,
	};
}

/**
 * Turns the selection into a link's text and selects the placeholder address, or turns a
 * selected `[text](address)` back into its text.
 */
function link(value: string, start: number, end: number): FormattedText {
	let selected = value.slice(start, end);
	let existing = /^\[([^\]]*)\]\(([^)]*)\)$/.exec(selected);
	if (existing) {
		let text = existing[1] ?? "";
		return {
			value: value.slice(0, start) + text + value.slice(end),
			start,
			end: start + text.length,
		};
	}
	let address = start + selected.length + 3;
	return {
		value: `${value.slice(0, start)}[${selected}](${LINK_PLACEHOLDER})${value.slice(end)}`,
		start: address,
		end: address + LINK_PLACEHOLDER.length,
	};
}

/**
 * Writes `prefix` before every line the selection touches, or removes it when every one of
 * them already starts with it. A caret keeps its place in its line's text; a range selects
 * the whole block, so pressing again toggles the same lines.
 */
function prefixLines(value: string, start: number, end: number, prefix: string): FormattedText {
	let lineStart = value.lastIndexOf("\n", start - 1) + 1;
	let blockEnd = end > start && value[end - 1] === "\n" ? end - 1 : end;
	let found = value.indexOf("\n", blockEnd);
	let lineEnd = found === -1 ? value.length : found;
	let lines = value.slice(lineStart, lineEnd).split("\n");
	let bare = prefix.trimEnd();
	let prefixed = lines.every((line) => line.startsWith(prefix) || line === bare);
	let next = lines.map((line) => {
		if (!prefixed) return line.startsWith(prefix) ? line : prefix + line;
		return line.startsWith(prefix) ? line.slice(prefix.length) : "";
	});
	let block = next.join("\n");
	let result = value.slice(0, lineStart) + block + value.slice(lineEnd);
	if (start === end) {
		let shift = (next[0]?.length ?? 0) - (lines[0]?.length ?? 0);
		let caret = Math.max(lineStart, start + shift);
		return { value: result, start: caret, end: caret };
	}
	return { value: result, start: lineStart, end: lineStart + block.length };
}
