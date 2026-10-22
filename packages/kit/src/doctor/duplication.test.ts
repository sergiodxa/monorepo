/**
 * The `duplication` check over fixture apps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { duplicationCheck } from "./duplication.js";
import { fixture, removeFixtures } from "./fixture.js";

afterEach(removeFixtures);

describe("duplicationCheck", () => {
	test("passes when modules differ", async () => {
		let context = await fixture({
			"app/models/a.ts": "export const a = 1;\nexport const b = 2;\n",
			"app/models/c.ts": "export const c = 3;\nexport const d = 4;\n",
		});
		expect((await duplicationCheck.run(context)).status).toBe("pass");
	});

	test("warns on a pasted block", async () => {
		let block = "export function run(x: number) {\n\treturn x + 1;\n}\n";
		let context = await fixture(
			{
				"app/services/a.ts": block,
				"app/services/b.ts": block,
			},
			{ config: { doctor: { duplication: { minLines: 2 } } } },
		);
		expect((await duplicationCheck.run(context)).status).toBe("warn");
	});
});
