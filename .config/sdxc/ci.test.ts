/**
 * The repository CI script's helpers: local test entries cap their Vitest workers and hold as
 * many concurrency slots, and example secrets fill only the apps without a `.dev.vars`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { LOCAL_TEST_WORKERS, missingDevVars, testStep } from "./ci.js";

describe("testStep", () => {
	test("caps a local entry's workers and holds as many slots", () => {
		expect(testStep('"/repo/packages/jwt/"', "local")).toEqual({
			command: `bun run test "/repo/packages/jwt/" --maxWorkers=${LOCAL_TEST_WORKERS}`,
			weight: LOCAL_TEST_WORKERS,
		});
	});

	test("keeps a CI host's entry at Vitest's own worker count and one slot", () => {
		expect(testStep("--project root", "remote")).toEqual({
			command: "bun run test --project root",
			weight: 1,
		});
	});
});

describe("missingDevVars", () => {
	test("pairs only the apps without a .dev.vars with their example", async () => {
		let root = await mkdtemp(join(tmpdir(), "sdxc-ci-script-"));
		try {
			await mkdir(join(root, "apps/blog"), { recursive: true });
			await mkdir(join(root, "apps/reader"), { recursive: true });
			await writeFile(join(root, "apps/blog/.dev.vars"), "SECRET=mine\n");
			let examples = ["apps/blog/.env.example", "apps/reader/.env.example"];
			expect(await missingDevVars(root, examples)).toEqual([
				{ example: "apps/reader/.env.example", devVars: "apps/reader/.dev.vars" },
			]);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
