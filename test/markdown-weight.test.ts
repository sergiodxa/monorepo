/**
 * Holds `@sdxc/markdown`'s entry points to the size budget the parser was
 * adopted on. A parser, a serializer and a walker fit the root entry's budget,
 * and a bundle that only parses never reaches the rendering runtime at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { weigh } from "./markdown-weight";

/** Repo root, resolved from this file so the build runs against the same tree from any cwd. */
const ROOT = join(import.meta.dirname, "..");

/** The budget the format entry is held to, in bytes: a ratchet just above what it weighs. */
const ROOT_BUDGET = 66 * 1024;

/** Plain-text extraction is a walk over the tree, so it carries no grammar of its own. */
const PLAIN_BUDGET = 4 * 1024;

/** Static HTML is a walk plus an escaper, so it stays close to the plain-text entry. */
const HTML_BUDGET = 8 * 1024;

describe("@sdxc/markdown stays inside its size budget", () => {
	test(`the format entry is under ${ROOT_BUDGET} bytes minified`, async () => {
		let weight = await weigh(join(ROOT, "packages/markdown/src/index.ts"), ROOT);

		expect(
			weight.minified,
			`minified ${weight.minified} bytes, ${weight.gzipped} gzipped`,
		).toBeLessThanOrEqual(ROOT_BUDGET);
	});

	test(`the plain-text entry is under ${PLAIN_BUDGET} bytes minified`, async () => {
		let weight = await weigh(join(ROOT, "packages/markdown/src/plain/index.ts"), ROOT);

		expect(
			weight.minified,
			`minified ${weight.minified} bytes, ${weight.gzipped} gzipped`,
		).toBeLessThanOrEqual(PLAIN_BUDGET);
	});

	test(`the static HTML entry is under ${HTML_BUDGET} bytes minified`, async () => {
		let weight = await weigh(join(ROOT, "packages/markdown/src/html/index.ts"), ROOT);

		expect(
			weight.minified,
			`minified ${weight.minified} bytes, ${weight.gzipped} gzipped`,
		).toBeLessThanOrEqual(HTML_BUDGET);
	});
});
