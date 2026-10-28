/**
 * Newline-delimited JSON-RPC framing for the MCP stdio transport: one message per line,
 * no embedded newlines, logs only on stderr.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Readable, Writable } from "node:stream";

/**
 * Reads newline-delimited JSON values from a readable stream until it ends.
 *
 * Incomplete trailing lines without a final newline are discarded when the stream closes,
 * matching how agents close stdin on process teardown.
 *
 * @param input Stdin (or a test double) that yields UTF-8 chunks.
 * @yields Each parsed JSON value, one per complete line.
 */
export async function* readJsonLines(input: Readable): AsyncGenerator<unknown> {
	let decoder = new TextDecoder();
	let buffer = "";

	for await (let chunk of input) {
		let text =
			typeof chunk === "string" ? chunk : decoder.decode(chunk as Buffer, { stream: true });
		buffer += text;
		let lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (let line of lines) {
			let trimmed = line.trim();
			if (trimmed.length === 0) continue;
			yield JSON.parse(trimmed) as unknown;
		}
	}
}

/**
 * Writes one JSON-RPC message as a single line ending in `\n`.
 *
 * @param output Stdout (or a test double). Must stay free of non-MCP writes.
 * @param message A request, notification, or response object.
 */
export function writeJsonLine(output: Writable, message: unknown): void {
	output.write(`${JSON.stringify(message)}\n`);
}

/**
 * Writes a diagnostic line to stderr. Stdout stays reserved for MCP frames.
 *
 * @param output Stderr (or a test double).
 * @param parts Values joined with spaces, stringified the way `console` would.
 */
export function writeLog(output: Writable, ...parts: unknown[]): void {
	let line = parts
		.map((part) => {
			if (typeof part === "string") return part;
			if (part instanceof Error) return part.message;
			try {
				return JSON.stringify(part);
			} catch {
				return String(part);
			}
		})
		.join(" ");
	output.write(`${line}\n`);
}
