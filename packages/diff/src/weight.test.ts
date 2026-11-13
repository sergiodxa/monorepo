/**
 * Holds the package entry to a gzipped size budget, so the aligners, the word diff and the
 * patch reader stay small enough to ship with any page or Worker that renders a diff.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { join } from "node:path";

import { weigh } from "@sdxc/bench";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

/** Repo root, so the bundle resolves the same workspace from any working directory. */
const ROOT = join(import.meta.dirname, "../../..");

/** The gzipped budget the entry is held to: a ratchet just above what it weighs. */
const BUDGET = 8 * 1024;

test(`the entry is under ${BUDGET} bytes gzipped`, async () => {
	let weight = unwrap(await weigh(join(import.meta.dirname, "index.ts"), ROOT));

	expect(
		weight.gzipped,
		`minified ${weight.minified} bytes, ${weight.gzipped} gzipped`,
	).toBeLessThan(BUDGET);
});
