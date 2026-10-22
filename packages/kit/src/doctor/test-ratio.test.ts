/**
 * The `test-ratio` check over fixture apps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { fixture, removeFixtures } from "./fixture.js";
import { testRatioCheck } from "./test-ratio.js";

afterEach(removeFixtures);

describe("testRatioCheck", () => {
	test("passes when the ratio meets the minimum", async () => {
		let context = await fixture({
			"app/models/post.ts": "export const post = 1;\n",
			"app/models/post.test.ts":
				"import { expect, test } from 'vitest';\ntest('x', () => expect(1).toBe(1));\n",
		});
		expect((await testRatioCheck.run(context)).status).toBe("pass");
	});

	test("warns when tests fall below doctor.testRatio.min", async () => {
		let context = await fixture(
			{
				"app/models/a.ts": "export const a = 1;\nexport const b = 2;\nexport const c = 3;\n",
				"app/models/a.test.ts": "export const t = 1;\n",
			},
			{ config: { doctor: { testRatio: { min: 2 } } } },
		);
		expect((await testRatioCheck.run(context)).status).toBe("warn");
	});
});
