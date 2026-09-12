/**
 * The frontmatter block: found, read as YAML, and checked against a schema. A
 * block YAML rejects fails with the line it stopped on, so a stray tab names
 * itself instead of arriving as an empty object the schema blames.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { failure, isFailure, success } from "@sdxc/result";
import { parse as parseYAML } from "@sdxc/yaml";

import type { Markdown } from "../index.js";

import { MarkdownParseError } from "./errors.js";

/** The delimiter a frontmatter block opens and closes on. */
const DELIMITER = "---";

/** The frontmatter block as read, and where the body after it begins. */
export interface FrontmatterBlock {
	/** The YAML value the block held, or `{}` when the file opens with no block. */
	value: unknown;
	/** Where the body starts, so block positions index the file as written. */
	bodyStart: Markdown.Point;
	/** The block's own span, which a failure points at. */
	position: Markdown.Position;
}

/**
 * Reads the block a file opens with, if it opens with one. A file whose opening
 * `---` never closes has written a thematic break, so the body starts at line 1
 * and the schema sees an empty object.
 *
 * @param source - The whole file
 * @returns The block's value and where the body begins, or the YAML failure with its line
 */
export function readFrontmatterBlock(source: string): Result<FrontmatterBlock, MarkdownParseError> {
	let opening = readDelimiterLine(source, 0);
	if (!opening) return success(missingBlock());

	let closing = findClosingDelimiter(source, opening.end);
	if (!closing) return success(missingBlock());

	let position: Markdown.Position = {
		start: { line: 1, column: 1, offset: 0 },
		end: {
			line: closing.line,
			column: DELIMITER.length + 1,
			offset: closing.start + DELIMITER.length,
		},
	};

	let body = source.slice(opening.end, closing.start);

	let parsed = parseYAML(body);
	if (isFailure(parsed)) {
		let line = 1 + parsed.error.line;
		return failure(
			new MarkdownParseError("Unreadable frontmatter block", {
				cause: parsed.error,
				position: {
					start: { line, column: 1, offset: 0 },
					end: { line, column: 1, offset: 0 },
				},
			}),
		);
	}

	if (!isMapping(parsed.data)) return success(missingBlock());

	return success({
		value: parsed.data,
		bodyStart: { line: closing.line + 1, column: 1, offset: closing.end },
		position,
	});
}

/**
 * Frontmatter is a set of named fields, so a delimited block holding anything
 * else — a scalar, a sequence, nothing at all — is a document that opens on a
 * thematic break, and its lines belong to the body.
 */
function isMapping(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Runs the schema, if there is one. Without a schema the value passes through as
 * read, typed `unknown`, which is what a caller that only wants the body gets.
 *
 * @param value - The YAML value the block held
 * @param position - The block's span, attached to a failure so issues name a line
 * @param schema - The caller's frontmatter schema
 * @returns The schema's output, or the issues it reported
 */
export function validateFrontmatter(
	value: unknown,
	position: Markdown.Position,
	schema?: StandardSchemaV1,
): Result<unknown, MarkdownParseError> {
	if (!schema) return success(value);

	let result = schema["~standard"].validate(value);
	if (result instanceof Promise) {
		return failure(
			new MarkdownParseError("Asynchronous frontmatter schemas are not supported", { position }),
		);
	}

	if (result.issues) {
		return failure(
			new MarkdownParseError("Invalid frontmatter", { position, issues: result.issues }),
		);
	}

	return success(result.value);
}

/** A file whose opening lines are not frontmatter still validates, against `{}`, so a required field fails at line 1. */
function missingBlock(): FrontmatterBlock {
	let start: Markdown.Point = { line: 1, column: 1, offset: 0 };
	return { value: {}, bodyStart: start, position: { start, end: start } };
}

/** The opening delimiter, which has to be the file's first line and hold nothing else. */
function readDelimiterLine(source: string, start: number): { end: number } | null {
	let breakAt = source.indexOf("\n", start);
	let line = breakAt === -1 ? source.slice(start) : source.slice(start, breakAt);

	if (line.trimEnd() !== DELIMITER) return null;

	return { end: breakAt === -1 ? source.length : breakAt + 1 };
}

/**
 * Scans for the line that closes the block, reporting where it sits and which line
 * it is, so the body's first point is the source's own rather than a recount.
 */
function findClosingDelimiter(
	source: string,
	from: number,
): { start: number; end: number; line: number } | null {
	let cursor = from;
	let line = 2;

	while (cursor <= source.length) {
		let breakAt = source.indexOf("\n", cursor);
		let text = breakAt === -1 ? source.slice(cursor) : source.slice(cursor, breakAt);

		if (text.trimEnd() === DELIMITER) {
			return {
				start: cursor,
				end: breakAt === -1 ? source.length : breakAt + 1,
				line,
			};
		}

		if (breakAt === -1) return null;

		cursor = breakAt + 1;
		line += 1;
	}

	return null;
}
