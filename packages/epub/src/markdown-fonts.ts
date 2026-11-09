/**
 * Embeds fonts in a Markdown book: each file is read with `@sdxc/font` for its family, weight
 * and style, refused when its license forbids embedding, and declared in one `@font-face`
 * stylesheet so no author writes the rules by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Font } from "@sdxc/font";
import type { Result } from "@sdxc/result";

import { parseFont } from "@sdxc/font";
import { parseWoff2 } from "@sdxc/font/woff2";
import { failure, success } from "@sdxc/result";

import type { ContainerPaths } from "./markdown-assets.js";

import { EpubFontError } from "./errors.js";

/** The folder fonts and their stylesheet are written under. */
export const FONT_FOLDER = "_book/fonts";

/** The stylesheet holding every `@font-face` rule, linked before any other. */
export const FONT_STYLESHEET = "_book/fonts.css";

/** A font file the caller passes in, named by where it came from. */
export interface FontFile {
	path: string;
	bytes: Uint8Array;
}

/** A font as the book declares it. */
export interface FontFace {
	family: string;
	/** The CSS `font-weight`, from the font's `usWeightClass`. */
	weight: number;
	style: "normal" | "italic";
	/** Where the file sits in the container. */
	path: string;
	bytes: Uint8Array;
	/** The file as passed in, for reports. */
	source: string;
}

/**
 * Reads, checks and places every font, each kept byte for byte as it was passed in.
 *
 * @param files - The fonts as passed in
 * @param paths - The container's path registry
 * @returns The faces in the order given, or the font failure naming the file
 */
export function embedFonts(
	files: readonly FontFile[],
	paths: ContainerPaths,
): Result<FontFace[], EpubFontError> {
	let faces: FontFace[] = [];
	for (let file of files) {
		let font = readFont(file);
		if (font.status === "failure") return font;

		let { allowed, bitmapOnly } = font.data.embedding;
		if (allowed === "restricted" || bitmapOnly) {
			return failure(
				new EpubFontError(
					`The license of "${file.path}" forbids embedding it in a document`,
					file.path,
				),
			);
		}

		let name = file.path.split("/").at(-1) ?? file.path;
		faces.push({
			family: font.data.family,
			weight: font.data.weightClass || 400,
			style: font.data.isItalic ? "italic" : "normal",
			path: paths.claim(name, FONT_FOLDER),
			bytes: file.bytes,
			source: file.path,
		});
	}
	return success(faces);
}

/** Opens a font file of any format the reader takes, WOFF2 included. */
function readFont(file: FontFile): Result<Font, EpubFontError> {
	let woff2 =
		file.bytes.byteLength >= 4 && new TextDecoder().decode(file.bytes.slice(0, 4)) === "wOF2";
	let parsed = woff2 ? parseWoff2(file.bytes) : parseFont(file.bytes);
	if (parsed.status === "success") return parsed;
	return failure(
		new EpubFontError(
			`"${file.path}" cannot be read as a font: ${parsed.error.message}`,
			file.path,
			{
				cause: parsed.error,
			},
		),
	);
}

/**
 * The `@font-face` rules for every face, each pointing at its file from the font stylesheet's
 * folder.
 */
export function fontFaceRules(faces: readonly FontFace[]): string {
	return faces
		.map((face) =>
			[
				"@font-face {",
				`\tfont-family: ${cssString(face.family)};`,
				`\tfont-weight: ${face.weight};`,
				`\tfont-style: ${face.style};`,
				`\tsrc: url("${face.path.slice("_book/".length)}");`,
				"}",
			].join("\n"),
		)
		.join("\n\n");
}

/** A CSS string literal, so a family name with quotes or backslashes stays one value. */
export function cssString(value: string): string {
	return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
