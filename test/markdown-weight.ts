/**
 * Measures what an entry point costs a bundle, by building it the way an app
 * would and weighing the output. The markdown parser replaced a dependency on
 * the strength of its size, so the number is asserted rather than remembered.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";

/** Bundling runs in a Bun child process, since the test runner itself is Node. */
const run = promisify(execFile);

/** What one built entry point weighs, in bytes. */
export interface Weight {
	minified: number;
	gzipped: number;
}

/**
 * Bundles and minifies `entry` and weighs the result. The build targets the
 * browser, the harshest reader: nothing stays external, so the number covers
 * every dependency the entry actually pulls in.
 *
 * @param entry - Path to the entry module
 * @param root - The repository root the build runs from
 * @returns The output's minified and gzipped size
 */
export async function weigh(entry: string, root: string): Promise<Weight> {
	let built = await run("bun", ["build", entry, "--minify", "--target=browser", "--format=esm"], {
		cwd: root,
		maxBuffer: 32 * 1024 * 1024,
	});

	let code = built.stdout;

	return {
		minified: Buffer.byteLength(code, "utf8"),
		gzipped: gzipSync(code).byteLength,
	};
}
