/**
 * Scanner that cuts a SQL script into the statements a `SqlStorage` handle can execute one
 * at a time, splitting only on the semicolons that actually terminate a statement.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Delimiter each quoted run closes with, keyed by the character that opens it. */
let closingDelimiters = new Map([
	["'", "'"],
	['"', '"'],
	["`", "`"],
	["[", "]"],
]);

/** How each quoted run is named when it reaches the end of the script unclosed. */
let quotedRunNames = new Map([
	["'", "string literal"],
	['"', "quoted identifier"],
	["`", "quoted identifier"],
	["[", "bracketed identifier"],
]);

/**
 * Splits a multi-statement SQL script into the statements it contains.
 *
 * A semicolon terminates a statement only outside a string literal, a quoted identifier, a
 * comment, and a `CREATE TRIGGER` body, so a script keeps the shape its author wrote:
 * `VALUES ('a;b')` stays one statement and a trigger arrives whole, body semicolons
 * included. Fragments holding only whitespace or comments are dropped, so a stray `;;` and
 * a closing `-- done` produce no statement rather than one the driver cannot execute.
 * @param script One or more `;`-separated SQL statements.
 * @returns The trimmed statements, in source order, each with its comments attached.
 * @throws When a quoted run, a block comment, or a trigger body never closes, naming what
 * is open and the line it opened on.
 * @example splitSqlStatements("SELECT 1; SELECT 2") // ["SELECT 1", "SELECT 2"]
 */
export function splitSqlStatements(script: string): string[] {
	let statements: string[] = [];
	let start = 0;
	let index = 0;

	/** Whether anything other than whitespace and comments has been read since `start`. */
	let hasContent = false;

	/** Keyword the statement being read opens with, upper-cased. */
	let leadingKeyword = "";

	/** Whether the statement being read is a `CREATE TRIGGER` whose body can still open. */
	let definesTrigger = false;

	/** Open `BEGIN` and `CASE` blocks inside a trigger body, where `;` separates the body. */
	let blockDepth = 0;

	/** Index the open trigger body started at, for the error naming an unclosed one. */
	let triggerBodyStart = 0;

	while (index < script.length) {
		let character = script[index] as string;

		if (closingDelimiters.has(character)) {
			index = scanQuoted(script, index);
			hasContent = true;
			continue;
		}

		if (isCommentStart(script, index)) {
			index = scanComment(script, index);
			continue;
		}

		if (isWordStart(character)) {
			let word = readWord(script, index);
			let keyword = word.toUpperCase();

			if (leadingKeyword === "") leadingKeyword = keyword;
			else if (keyword === "TRIGGER" && leadingKeyword === "CREATE") definesTrigger = true;

			if (definesTrigger && blockDepth === 0 && keyword === "BEGIN") {
				blockDepth = 1;
				triggerBodyStart = index;
			} else if (blockDepth > 0 && keyword === "CASE") {
				blockDepth += 1;
			} else if (blockDepth > 0 && keyword === "END") {
				blockDepth -= 1;

				// The trigger's own END closes the body, and what follows belongs to the
				// statement that ends at the next top-level semicolon.
				if (blockDepth === 0) definesTrigger = false;
			}

			index += word.length;
			hasContent = true;
			continue;
		}

		if (character === ";" && blockDepth === 0) {
			if (hasContent) statements.push(script.slice(start, index).trim());

			index += 1;
			start = index;
			hasContent = false;
			leadingKeyword = "";
			definesTrigger = false;
			continue;
		}

		if (character.trim() !== "") hasContent = true;

		index += 1;
	}

	if (blockDepth > 0) {
		throw new Error(
			`SQL script has a CREATE TRIGGER body opened on ${describeLine(script, triggerBodyStart)} that never closes with END`,
		);
	}

	if (hasContent) statements.push(script.slice(start).trim());

	return statements;
}

/** Reports whether a `--` line comment or a `/*` block comment opens at `index`. */
function isCommentStart(script: string, index: number): boolean {
	let character = script[index];
	let next = script[index + 1];

	return (character === "-" && next === "-") || (character === "/" && next === "*");
}

/**
 * Scans past the comment opening at `index`. A line comment runs to the newline that ends
 * it, or to the end of a script whose last line carries it.
 * @throws When a block comment reaches the end of the script unclosed.
 */
function scanComment(script: string, index: number): number {
	if (script[index] === "-") {
		let end = script.indexOf("\n", index);
		return end === -1 ? script.length : end + 1;
	}

	let end = script.indexOf("*/", index + 2);

	if (end === -1) {
		throw new Error(
			`SQL script has an unterminated block comment opened on ${describeLine(script, index)}`,
		);
	}

	return end + 2;
}

/**
 * Scans past the quoted run opening at `index`, honouring SQLite's doubled-delimiter escape
 * so `'it''s'` reads as one literal.
 * @throws When the run reaches the end of the script unclosed, naming the kind of run it is.
 */
function scanQuoted(script: string, index: number): number {
	let open = script[index] as string;
	let close = closingDelimiters.get(open) as string;
	let cursor = index + 1;

	while (cursor < script.length) {
		if (script[cursor] !== close) {
			cursor += 1;
			continue;
		}

		// A bracketed identifier ends at its first `]`, which is why SQLite gives it no
		// escape and the doubling rule covers the three symmetric delimiters instead.
		if (open !== "[" && script[cursor + 1] === close) {
			cursor += 2;
			continue;
		}

		return cursor + 1;
	}

	throw new Error(
		`SQL script has an unterminated ${quotedRunNames.get(open) as string} opened on ${describeLine(script, index)}`,
	);
}

/** Reports whether a bare word, which may be a keyword, starts at `character`. */
function isWordStart(character: string): boolean {
	return (
		(character >= "a" && character <= "z") ||
		(character >= "A" && character <= "Z") ||
		character === "_"
	);
}

/** Reads the bare word starting at `index`, letters, digits, underscores and `$` included. */
function readWord(script: string, index: number): string {
	let end = index;

	while (end < script.length) {
		let character = script[end] as string;

		if (isWordStart(character) || (character >= "0" && character <= "9") || character === "$") {
			end += 1;
			continue;
		}

		break;
	}

	return script.slice(index, end);
}

/** Names the line `index` falls on, counted from 1, for an error a script author can act on. */
function describeLine(script: string, index: number): string {
	let line = 1;

	for (let cursor = 0; cursor < index; cursor++) {
		if (script[cursor] === "\n") line += 1;
	}

	return `line ${String(line)}`;
}
