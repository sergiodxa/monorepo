/**
 * Renders Murmur's drawn covers, genre tiles and artist pictures as the SVG files under
 * `public/demos/murmur/art/`, so pages load each picture once by URL, cached across screens.
 * The test beside it rewrites them with `MURMUR_ART_WRITE=1` and fails while one is stale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToString } from "remix/component/server";

import { artFiles } from "~/resources/views/demo-apps/murmur/art";

/** The folder the art is served from. */
export const ART_DIR = fileURLToPath(new URL("../public/demos/murmur/art", import.meta.url));

/**
 * Renders every art file's content, keyed by its file name.
 *
 * @returns Each file name with the SVG document it holds.
 */
export async function renderArt(): Promise<Map<string, string>> {
	let files = new Map<string, string>();
	for (let entry of artFiles()) files.set(entry.file, `${await renderToString(entry.node)}\n`);
	return files;
}

/**
 * Writes every art file and removes any file nothing draws any more.
 *
 * @param files The files {@link renderArt} produced.
 */
export function writeArt(files: Map<string, string>): void {
	mkdirSync(ART_DIR, { recursive: true });
	for (let name of readdirSync(ART_DIR)) {
		if (!files.has(name)) rmSync(join(ART_DIR, name));
	}
	for (let [name, svg] of files) writeFileSync(join(ART_DIR, name), svg);
}
