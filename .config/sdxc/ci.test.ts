/**
 * The repository CI script's test entries: locally each caps its Vitest workers and holds as
 * many concurrency slots, so a full run keeps about one worker per core.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { LOCAL_TEST_WORKERS, testStep } from "./ci.js";

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
