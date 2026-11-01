/**
 * Opens the font file a command was pointed at, from a path or from stdin, as every font it
 * holds: a WOFF2 is decoded first and a collection yields each of its fonts, so `inspect` and
 * `subset` read the same files and report an unreadable one with the same exit code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

import type { AnyCommandContext, ExitError, UsageError } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { exit, usage } from "@sdxc/cli";
import { isFailure, success } from "@sdxc/result";

import type { FontCollection } from "./collection.js";
import type { FontError } from "./font-error.js";

import { parseFontCollection } from "./collection.js";
import { decodeWoff2 } from "./woff2/index.js";

/** The fonts of one file and the name diagnostics call it by: the path as typed, or `<stdin>`. */
export interface FontInput {
	name: string;
	collection: FontCollection;
}

/**
 * Every font in `file`, resolved against the run's directory; `-` reads stdin as bytes.
 *
 * @param ctx - The running command, for its directory
 * @param file - The path argument as typed
 * @returns The fonts, a usage error when stdin is a terminal, or an exit 2 naming the file
 *   that could not be read or parsed
 */
export async function readFontInput(
	ctx: Pick<AnyCommandContext, "cwd">,
	file: string,
): Promise<Result<FontInput, ExitError | UsageError>> {
	let name = file === "-" ? "<stdin>" : file;
	let bytes: Uint8Array;
	if (file === "-") {
		if (process.stdin.isTTY) return usage("Pass a font file, or pipe one to stdin.");
		bytes = await readStdin();
	} else {
		try {
			bytes = new Uint8Array(await readFile(resolve(ctx.cwd, file)));
		} catch (error) {
			let reason = error instanceof Error ? error.message : String(error);
			return exit(2, `Cannot read ${file}: ${reason}`);
		}
	}
	let collection = openFonts(bytes);
	if (isFailure(collection)) return exit(2, `${name}: ${collection.error.message}`);
	return success({ name, collection: collection.data });
}

/**
 * Every font in `bytes`, decoding a WOFF2 first, so a failed decode and a failed parse reach
 * the caller as one `FontError`.
 */
function openFonts(bytes: Uint8Array): Result<FontCollection, FontError> {
	if (!isWoff2(bytes)) return parseFontCollection(bytes);
	let sfnt = decodeWoff2(bytes);
	if (isFailure(sfnt)) return sfnt;
	return parseFontCollection(sfnt.data);
}

/** Whether `bytes` start with the WOFF2 signature `wOF2`. */
function isWoff2(bytes: Uint8Array): boolean {
	return bytes[0] === 0x77 && bytes[1] === 0x4f && bytes[2] === 0x46 && bytes[3] === 0x32;
}

/** Everything piped to the process, kept as bytes because a font is binary. */
async function readStdin(): Promise<Uint8Array> {
	let chunks: Uint8Array[] = [];
	let length = 0;
	for await (let chunk of process.stdin as AsyncIterable<Uint8Array>) {
		chunks.push(chunk);
		length += chunk.byteLength;
	}
	let bytes = new Uint8Array(length);
	let offset = 0;
	for (let chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}
