/**
 * The artifacts directory: where a failing test leaves what a person needs to
 * see it — a screenshot, an accessibility-tree dump, a parsed document. A run
 * without `--artifacts=<dir>` has no store, so a tool that would write one
 * simply does not, and its diagnostics stay text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/** Characters a file name keeps; every other run collapses to one dash. */
const UNSAFE_NAME = /[^a-zA-Z0-9._-]+/g;

/** Where a run's failure artifacts are written, when the caller asked for any. */
export interface ArtifactStore {
	/** The directory artifacts land in, printed alongside every path. */
	directory: string;
	/**
	 * Write one artifact and answer with its path, which a diagnostic prints.
	 *
	 * @param name - File name within the store, e.g. `"failure.png"`.
	 * @param contents - What to write, text or bytes.
	 * @returns The written path, or undefined when the write failed — a
	 * diagnostic is never worth failing a test that already failed.
	 */
	write(name: string, contents: string | Uint8Array): Promise<string | undefined>;
}

/**
 * Build the run's artifact store, rooted at the caller's `--artifacts` path.
 *
 * @param directory - Where artifacts go, resolved against the working directory.
 * @returns The store every test writes its failure artifacts through.
 */
export function createArtifactStore(directory: string): ArtifactStore {
	let root = resolve(directory);
	return {
		directory: root,
		async write(name, contents) {
			let path = join(root, sanitize(name));
			try {
				await mkdir(dirname(path), { recursive: true });
				await writeFile(path, contents);
				return path;
			} catch {
				return undefined;
			}
		},
	};
}

/**
 * A file name a test's title can safely become: the readable characters kept,
 * everything else one dash, so an artifact is still findable by eye.
 *
 * @param name - The name a tool asked for.
 * @returns A name that is one path segment and holds no separators.
 */
export function sanitize(name: string): string {
	let cleaned = name.replace(UNSAFE_NAME, "-").replace(/^-+|-+$/g, "");
	return cleaned === "" ? "artifact" : cleaned;
}
