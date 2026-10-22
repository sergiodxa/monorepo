/**
 * The `module-size` check: modules within the line budget pass, oversized ones warn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { fixture, removeFixtures } from "./fixture.js";
import { moduleSizeCheck } from "./module-size.js";

afterEach(removeFixtures);

describe("moduleSizeCheck", () => {
	test("passes a small module", async () => {
		let context = await fixture({
			"app/models/post.ts": `export const post = 1;\n`,
		});
		expect((await moduleSizeCheck.run(context)).status).toBe("pass");
	});

	test("warns when code lines exceed the configured budget", async () => {
		let body = Array.from({ length: 20 }, (_, i) => `export const n${i} = ${i};`).join("\n");
		let context = await fixture(
			{ "app/models/big.ts": `${body}\n` },
			{ config: { doctor: { complexity: { moduleLines: 10 } } } },
		);

		let result = await moduleSizeCheck.run(context);

		expect(result.status).toBe("warn");
		expect(result.findings[0]).toMatch(/big\.ts: 20 code lines \(max 10\)/);
	});
});
