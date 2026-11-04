/**
 * Weighs a tiny local entry and holds it to a gzipped budget.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { assertWeight, weigh } from "./weigh.js";

describe("weigh", () => {
	test("measures a tiny module's gzipped size", async () => {
		let root = await mkdtemp(join(tmpdir(), "sdxc-bench-"));
		let entry = join(root, "index.ts");
		await writeFile(entry, "export const value = 1;\n");

		let weight = unwrap(await weigh(entry, root));
		expect(weight.minified).toBeGreaterThan(0);
		expect(weight.gzipped).toBeGreaterThan(0);
		expect(isFailure(assertWeight(weight, { maxGzipped: weight.gzipped }))).toBe(false);
		expect(isFailure(assertWeight(weight, { maxGzipped: weight.gzipped - 1 }))).toBe(true);
	});

	test("fails when the entry cannot be built", async () => {
		let root = await mkdtemp(join(tmpdir(), "sdxc-bench-"));
		await mkdir(join(root, "missing"), { recursive: true });
		let result = await weigh(join(root, "nope.ts"), root);
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.code).toBe("build");
	});
});
