/**
 * Splits master-file text into entries: one per line, or one per parenthesized group of
 * lines, each a list of fields with its trailing comment. Quotes, escapes and parentheses
 * are settled here, so the entry reader sees fields and never characters.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One field of an entry, as written: quotes and escapes kept for the field's own reader. */
export interface Token {
	text: string;
	quoted: boolean;
}

/** One logical entry of a zone file: a directive, a record, or something unreadable. */
export interface Entry {
	line: number;
	endLine: number;
	/** The first line starts with whitespace, which leaves the owner to the previous entry. */
	blankOwner: boolean;
	tokens: Token[];
	/** The `;` comment outside parentheses, trimmed; `null` without one. */
	comment: string | null;
	/** Why the entry cannot be read; `null` when it lexed cleanly. */
	error: string | null;
	/** The entry as written, every line of it. */
	input: string;
}

/** Whether a character separates fields. */
function isSpace(char: string | undefined): boolean {
	return char === " " || char === "\t" || char === "\r";
}

/** Whether a character ends a bare field. */
function endsField(char: string | undefined): boolean {
	return isSpace(char) || char === ";" || char === "(" || char === ")";
}

/**
 * The index of the quote closing the one at `start`, skipping escaped characters, or `-1`
 * when the line ends first.
 */
function closingQuote(line: string, start: number): number {
	let end = start + 1;
	while (end < line.length && line[end] !== '"') end += line[end] === "\\" ? 2 : 1;
	return end < line.length ? end : -1;
}

/**
 * Splits text into entries. Blank and comment-only lines produce none; an entry whose
 * parentheses never close runs to the end of the text and carries an error, as does one
 * with a quote left open at the end of a line.
 *
 * @param text - The zone file's contents.
 * @returns The entries in file order.
 * @example lex("www IN A 192.0.2.1 ; web")[0]?.tokens.length // 4
 */
export function lex(text: string): Entry[] {
	let lines = text.split(/\r?\n/);
	let entries: Entry[] = [];
	let current: Entry | null = null;
	let depth = 0;
	let firstLine = 0;

	for (let index = 0; index < lines.length; index++) {
		let line = lines[index] ?? "";

		if (current === null) {
			firstLine = index;
			current = {
				line: index + 1,
				endLine: index + 1,
				blankOwner: isSpace(line[0]),
				tokens: [],
				comment: null,
				error: null,
				input: "",
			};
		}
		let entry: Entry = current;
		entry.endLine = index + 1;

		let fail = (message: string) => {
			entry.error ??= message;
		};

		let position = 0;
		while (position < line.length) {
			let char = line[position];

			if (isSpace(char)) {
				position += 1;
			} else if (char === ";") {
				let comment = line.slice(position + 1).trim();
				if (depth === 0) entry.comment = comment.length > 0 ? comment : null;
				break;
			} else if (char === "(") {
				if (depth > 0) fail("Parentheses cannot nest");
				depth = 1;
				position += 1;
			} else if (char === ")") {
				if (depth === 0) fail("A closing parenthesis has no opening one");
				depth = 0;
				position += 1;
			} else if (char === '"') {
				let end = closingQuote(line, position);
				if (end === -1) {
					fail("A quoted string cannot span lines");
					entry.tokens.push({ text: `${line.slice(position)}"`, quoted: true });
					break;
				}
				entry.tokens.push({ text: line.slice(position, end + 1), quoted: true });
				position = end + 1;
			} else {
				let end = position;
				while (end < line.length && !endsField(line[end])) {
					if (line[end] === '"') {
						let closing = closingQuote(line, end);
						if (closing === -1) {
							fail("A quoted string cannot span lines");
							end = line.length;
							break;
						}
						end = closing + 1;
					} else {
						end += line[end] === "\\" ? 2 : 1;
					}
				}
				entry.tokens.push({ text: line.slice(position, end), quoted: false });
				position = end;
			}
		}

		if (depth === 0) {
			entry.input = lines.slice(firstLine, index + 1).join("\n");
			if (entry.tokens.length > 0 || entry.error !== null) entries.push(entry);
			current = null;
		}
	}

	if (current !== null) {
		current.error ??= "An opening parenthesis is never closed";
		current.input = lines.slice(firstLine).join("\n");
		entries.push(current);
	}

	return entries;
}
