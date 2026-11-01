/**
 * The `sdxc-font subset` handler: keeps the glyphs a text draws, optionally at one instance of
 * a variable font, and writes the subset from `@sdxc/font/subset` to a file or stdout. With
 * `--json` it prints which subset glyph id each character landed on, the mapping a PDF needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import process from "node:process";

import type { UsageError } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { createCommand, exit, failure, success, usage } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { Font } from "./font.js";

import { FONT_COMMANDS } from "./cli-contract.js";
import { readFontInput } from "./cli-input.js";
import { subset } from "./subset/index.js";
import { instance } from "./variations/index.js";

/** One character of the text and the glyph that draws it, before and after subsetting. */
interface MappedCharacter {
	character: string;
	codePoint: number;
	glyph: number;
	subsetGlyph: number;
}

/**
 * Writes the subset, then reports on stderr (or as JSON on stdout) how many glyphs it holds
 * and which characters the font has no glyph for; those are warnings, so the run still exits 0.
 * A font whose license forbids subsetting exits 1.
 */
export default createCommand(FONT_COMMANDS.subset, async (ctx) => {
	let { output, json } = ctx.flags;
	if (json && output === undefined) return usage("--json needs --output for the font itself.");
	if (output === undefined && process.stdout.isTTY) {
		return usage("Refusing to write a binary font to a terminal; pass --output.");
	}

	let text = await readText(ctx.cwd, ctx.flags.text, ctx.flags.textFile);
	if (isFailure(text)) return text;

	let input = await readFontInput(ctx, ctx.arguments.font ?? "-");
	if (isFailure(input)) return input;
	let { fonts } = input.data.collection;
	let picked = ctx.flags.name === undefined ? fonts[0] : input.data.collection.get(ctx.flags.name);
	if (picked === null || picked === undefined) {
		let names = fonts.map((each) => each.postscriptName).join(", ");
		return exit(2, `${input.data.name} holds no font named ${ctx.flags.name}; it holds ${names}.`);
	}

	let font: Font = picked;
	if (ctx.flags.instance !== undefined) {
		let settings = parseInstance(ctx.flags.instance);
		if (isFailure(settings)) return settings;
		let fixed = instance(font, settings.data);
		if (isFailure(fixed)) return exit(2, `${input.data.name}: ${fixed.error.message}`);
		font = fixed.data;
	}

	let characters = charactersOf(text.data);
	let found = characters.filter((codePoint) => font.glyphIndex(codePoint) !== 0);
	let missing = characters.filter((codePoint) => font.glyphIndex(codePoint) === 0);
	let result = subset(
		font,
		found.map((codePoint) => font.glyphIndex(codePoint)),
	);
	if (isFailure(result)) return failure(result.error);
	let { bytes, glyphs } = result.data;

	if (output === undefined) {
		await writeStdout(bytes);
	} else {
		try {
			await writeFile(resolvePath(ctx.cwd, output), bytes);
		} catch (error) {
			let reason = error instanceof Error ? error.message : String(error);
			return exit(2, `Cannot write ${output}: ${reason}`);
		}
	}

	if (json) {
		let mapped: MappedCharacter[] = found.map((codePoint) => {
			let glyph = font.glyphIndex(codePoint);
			return {
				character: String.fromCodePoint(codePoint),
				codePoint,
				glyph,
				subsetGlyph: result.data.glyphId(glyph),
			};
		});
		let report = {
			output,
			bytes: bytes.byteLength,
			glyphCount: glyphs.length,
			characters: mapped,
			missing: missing.map((codePoint) => ({
				character: String.fromCodePoint(codePoint),
				codePoint,
			})),
		};
		ctx.stdout(`${JSON.stringify(report, null, 2)}\n`);
		return success();
	}

	if (missing.length > 0) {
		ctx.stderr(`No glyph for ${missing.map(describeCodePoint).join(", ")}\n`);
	}
	let target = output ?? "<stdout>";
	ctx.stderr(`Wrote ${target}: ${glyphs.length} glyphs, ${bytes.byteLength} bytes\n`);
	return success();
});

/**
 * The text whose characters to keep: `--text` as typed, or the UTF-8 contents of
 * `--text-file`. Exactly one of the two must be given.
 *
 * @param cwd - The run's directory, for resolving `--text-file`
 * @param text - The `--text` flag
 * @param textFile - The `--text-file` flag
 */
async function readText(
	cwd: string,
	text: string | undefined,
	textFile: string | undefined,
): Promise<Result<string, Error>> {
	if ((text === undefined) === (textFile === undefined)) {
		return usage("Pass the characters to keep with exactly one of --text or --text-file.");
	}
	if (text !== undefined) return success(text);
	try {
		return success(await readFile(resolvePath(cwd, textFile as string), "utf8"));
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return exit(2, `Cannot read ${textFile}: ${reason}`);
	}
}

/**
 * `--instance` as `instance()` takes it: `wght=700,wdth=80` as axis values, anything without
 * `=` as the name of a named instance.
 *
 * @param value - The flag as typed
 */
function parseInstance(value: string): Result<string | Record<string, number>, UsageError> {
	if (!value.includes("=")) return success(value);
	let settings: Record<string, number> = {};
	for (let pair of value.split(",")) {
		let [tag = "", number = ""] = pair.split("=");
		let parsed = Number(number);
		if (tag.trim() === "" || number.trim() === "" || !Number.isFinite(parsed)) {
			return usage(
				`--instance expects axis=value pairs such as wght=700; got ${JSON.stringify(pair)}`,
			);
		}
		settings[tag.trim()] = parsed;
	}
	return success(settings);
}

/**
 * The distinct code points of `text` in first-seen order, leaving out control characters,
 * so a text file's line breaks never count as characters the font lacks.
 */
function charactersOf(text: string): number[] {
	let seen = new Set<number>();
	for (let character of text) {
		let codePoint = character.codePointAt(0) as number;
		if (codePoint < 0x20 || (codePoint >= 0x7f && codePoint < 0xa0)) continue;
		seen.add(codePoint);
	}
	return [...seen];
}

/** A character as a person reads it in a diagnostic: `✓ (U+2713)`. */
function describeCodePoint(codePoint: number): string {
	let hex = codePoint.toString(16).toUpperCase().padStart(4, "0");
	return `${String.fromCodePoint(codePoint)} (U+${hex})`;
}

/**
 * Writes `bytes` to the process's stdout and waits until they are flushed, so the exit that
 * follows never truncates a piped font.
 */
function writeStdout(bytes: Uint8Array): Promise<void> {
	return new Promise((resolve, reject) => {
		process.stdout.write(bytes, (error) => (error ? reject(error) : resolve()));
	});
}
