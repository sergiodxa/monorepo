/**
 * The `crap` check: skips without coverage, warns when a scored function exceeds the limit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { crapCheck } from "./crap.js";
import { fixture, removeFixtures } from "./fixture.js";

afterEach(removeFixtures);

describe("crapCheck", () => {
	test("skips when the coverage file is missing", async () => {
		let context = await fixture({
			"app/models/post.ts": `export function load() {\n\treturn 1;\n}\n`,
		});
		let result = await crapCheck.run(context);
		expect(result.status).toBe("skip");
		expect(result.message).toMatch(/No coverage at coverage\/coverage-final\.json/);
	});

	test("warns when CRAP exceeds the configured maximum", async () => {
		let context = await fixture(
			{
				"app/models/post.ts": `export function load(x: number) {\n\tif (x) return 1;\n\treturn 0;\n}\n`,
				"coverage/coverage-final.json": JSON.stringify({
					"app/models/post.ts": {
						path: "app/models/post.ts",
						fnMap: { "0": { name: "load", decl: { start: { line: 1 } } } },
						f: { "0": 0 },
					},
				}),
			},
			{ config: { doctor: { complexity: { crap: 2 } } } },
		);

		let result = await crapCheck.run(context);

		expect(result.status).toBe("warn");
		expect(result.findings[0]).toMatch(/load CRAP/);
	});
});
