/**
 * The `complexity` check over fixture apps: functions within the limit pass, above it warn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { complexityCheck } from "./complexity.js";
import { fixture, removeFixtures } from "./fixture.js";

afterEach(removeFixtures);

describe("complexityCheck", () => {
	test("passes functions at or under the limit", async () => {
		let context = await fixture({
			"app/services/ok.ts": `export function run(x: number) {\n\tif (x) return 1;\n\treturn 0;\n}\n`,
		});
		expect((await complexityCheck.run(context)).status).toBe("pass");
	});

	test("warns when a function exceeds doctor.complexity.max", async () => {
		let context = await fixture(
			{
				"app/services/fat.ts": `export function run(a: number, b: number, c: number) {
	if (a) {
		if (b) {
			if (c) return 1;
			return 2;
		}
		return 3;
	}
	return 0;
}
`,
			},
			{ config: { doctor: { complexity: { max: 3 } } } },
		);

		let result = await complexityCheck.run(context);

		expect(result.status).toBe("warn");
		expect(result.findings[0]).toMatch(/fat\.ts:\d+: run has complexity \d+ \(max 3\)/);
	});
});
