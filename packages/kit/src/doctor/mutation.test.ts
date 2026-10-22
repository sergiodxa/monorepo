/**
 * The `mutation` check: skips without a report, warns on survivors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { fixture, removeFixtures } from "./fixture.js";
import { mutationCheck, survivingMutants } from "./mutation.js";

afterEach(removeFixtures);

describe("mutationCheck", () => {
	test("skips when the report is missing", async () => {
		let context = await fixture({ "app/models/post.ts": "export const post = 1;\n" });
		expect((await mutationCheck.run(context)).status).toBe("skip");
	});

	test("warns when survivors exceed the max", async () => {
		let context = await fixture(
			{
				"reports/mutation/mutation.json": JSON.stringify({
					files: {
						"app/models/post.ts": {
							mutants: [
								{ id: "1", status: "Survived", mutatorName: "BooleanLiteral" },
								{ id: "2", status: "Killed", mutatorName: "StringLiteral" },
							],
						},
					},
				}),
			},
			{ config: { doctor: { mutation: { maxSurvived: 0 } } } },
		);
		expect((await mutationCheck.run(context)).status).toBe("warn");
	});
});

describe("survivingMutants", () => {
	test("reads a survived count", () => {
		expect(survivingMutants({ survived: 3 }).count).toBe(3);
	});
});
