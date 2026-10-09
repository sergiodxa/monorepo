/**
 * Reads diagram source into statements: one per non-blank line, trimmed, with
 * `%%` comment lines dropped and each statement keeping its offset so a parser
 * can point a `DiagramError` at the exact character it refused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DiagramError } from "./errors.js";

/** One line of the diagram, trimmed. */
export interface Statement {
	text: string;
	/** Offset of the first character of {@link Statement.text} in the source. */
	index: number;
}

/** The parts every diagram shares: its kind line, the statements after it, and its accessible text. */
export interface DiagramSource {
	source: string;
	header: Statement;
	body: Statement[];
	/** From `title`, `accTitle` or a frontmatter `title`, whichever comes last. */
	title?: string;
	/** From `accDescr`. */
	description?: string;
}

/**
 * Splits the source and takes out the frontmatter block and the title and
 * description statements, which every diagram kind accepts anywhere.
 *
 * @param source - The diagram as written
 * @returns The header and body statements
 * @throws {DiagramError} When the source holds no statement at all
 */
export function readSource(source: string): DiagramSource {
	let all = statements(source);
	let title: string | undefined;
	let description: string | undefined;

	if (all[0]?.text === "---") {
		let close = all.findIndex((statement, index) => index > 0 && statement.text === "---");
		if (close === -1) throw new DiagramError("Unclosed frontmatter", source, all[0].index);
		for (let statement of all.slice(1, close)) {
			let match = /^title\s*:\s*(.*)$/.exec(statement.text);
			if (match?.[1]) title = unquote(match[1]);
		}
		all = all.slice(close + 1);
	}

	let [header, ...rest] = all;
	if (!header) throw new DiagramError("Empty diagram", source, source.length);

	let body: Statement[] = [];
	for (let statement of rest) {
		let match = /^(accTitle\s*:|accDescr\s*:|title\s)\s*(.*)$/.exec(statement.text);
		if (!match) {
			body.push(statement);
			continue;
		}
		let value = (match[2] ?? "").trim();
		if (match[1]?.startsWith("accDescr")) description = value;
		else title = value;
	}

	return { source, header, body, title, description };
}

/**
 * @param source - The diagram as written
 * @returns Every line that holds something besides a `%%` comment
 */
export function statements(source: string): Statement[] {
	let result: Statement[] = [];
	let offset = 0;

	for (let line of source.split("\n")) {
		let text = line.trim();
		if (text !== "" && !text.startsWith("%%")) {
			result.push({ text, index: offset + line.indexOf(text) });
		}
		offset += line.length + 1;
	}

	return result;
}

/**
 * @param value - Text that may be wrapped in double quotes
 * @returns The text without them
 */
export function unquote(value: string): string {
	let trimmed = value.trim();
	if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}
