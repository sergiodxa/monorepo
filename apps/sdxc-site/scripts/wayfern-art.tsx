/**
 * Renders Wayfern's drawn stays' photos as the SVG files under `public/demos/wayfern/photos/`,
 * so pages load each picture once by URL, cached across screens, instead of inlining it. The
 * test beside it rewrites them with `WAYFERN_ART_WRITE=1` and fails while one is stale.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToString } from "remix/component/server";

import { PhotoSvg, photoFiles } from "~/resources/views/demo-apps/wayfern/art";
import { STAYS } from "~/resources/views/demo-apps/wayfern/data";

/** The folder the art is served from. */
export const ART_DIR = fileURLToPath(new URL("../public/demos/wayfern/photos", import.meta.url));

/**
 * Renders every art file's content, keyed by its file name.
 *
 * @returns Each file name with the SVG document it holds.
 */
export async function renderArt(): Promise<Map<string, string>> {
	let files = new Map<string, string>();
	for (let entry of photoFiles(STAYS)) {
		let svg = await renderToString(<PhotoSvg stay={entry.stay} kind={entry.kind} />);
		files.set(entry.file, `${svg}\n`);
	}
	return files;
}

/**
 * Writes every art file and removes any file no stay draws any more.
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
