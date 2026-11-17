/**
 * Renders Vesper's drawn key art and episode stills as the SVG files under `public/demos/vesper/art/`,
 * so pages load each picture once by URL, cached across screens, instead of inlining it. The
 * test beside it rewrites them with `VESPER_ART_WRITE=1` and fails while one is stale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToString } from "remix/component/server";

import { SceneSvg, artFiles } from "~/resources/views/demo-apps/vesper/art";
import { TITLES } from "~/resources/views/demo-apps/vesper/data";

/** The folder the art is served from. */
export const ART_DIR = fileURLToPath(new URL("../public/demos/vesper/art", import.meta.url));

/**
 * Renders every art file's content, keyed by its file name.
 *
 * @returns Each file name with the SVG document it holds.
 */
export async function renderArt(): Promise<Map<string, string>> {
	let files = new Map<string, string>();
	for (let entry of artFiles(TITLES)) {
		let svg = await renderToString(<SceneSvg title={entry.title} frame={entry.frame} />);
		files.set(entry.file, `${svg}\n`);
	}
	return files;
}

/**
 * Writes every art file and removes any file no title draws any more.
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
