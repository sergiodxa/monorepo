/**
 * Runs every markdown file the applications serve through `@sdxc/markdown` and
 * checks the two properties the serializer promises: writing a parsed document
 * back is idempotent, and its output survives the repository's own formatter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Markdown } from "@sdxc/markdown";
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { contentFiles, format } from "./markdown-corpus";

/** Repo root, resolved from this file so the scan targets the same tree from any cwd. */
const ROOT = join(import.meta.dirname, "..");

/** Writes a document back through the package, which only the frontmatter branch can fail. */
function roundTrip(source: string): string {
	return unwrap(Markdown.stringify(unwrap(Markdown.parse(source)).document));
}

describe("the markdown corpus round-trips", () => {
	let files = contentFiles(ROOT);

	test("the corpus is where it is expected to be", () => {
		expect(files.length).toBeGreaterThan(0);
	});

	test.each(files)("%s parses and writes back idempotently", (file) => {
		let source = readFileSync(join(ROOT, file), "utf8");
		let once = roundTrip(source);

		expect(roundTrip(once)).toBe(once);
	});

	test.each(files)("%s writes back to a fixed point of the formatter", (file) => {
		let source = readFileSync(join(ROOT, file), "utf8");
		let written = roundTrip(source);

		expect(format(written, ROOT)).toBe(written);
	});
});
