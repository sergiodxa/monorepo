/**
 * The `ci` check over fixture projects: a script whose steps each have their own name passes,
 * a repeated name or a script that will not load fails, and a project without a script skips.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { ciCheck } from "./ci.js";
import { fixture, removeFixtures } from "./fixture.js";

afterEach(removeFixtures);

/** The default script path. */
const SCRIPT = ".config/sdxc/ci.ts";

describe("ciCheck", () => {
	test("passes when every step has its own name, a matrix entry's prefix included", async () => {
		let context = await fixture({
			[SCRIPT]: `export default async (ci) => {
	await ci.step("Lint", "exit 1", { halt: true });
	await ci.matrix("Apps", ["blog", "shop"], (app) => ci.step("Test", "exit 1"));
};
`,
		});

		expect(await ciCheck.run(context)).toEqual({
			status: "pass",
			message: ".config/sdxc/ci.ts loads, and each of its 3 steps has its own name",
			findings: [],
			fix: null,
		});
	});

	test("fails naming a step name used twice in one scope", async () => {
		let context = await fixture({
			[SCRIPT]: `export default async (ci) => {
	await ci.parallel("Checks", [() => ci.step("Lint", "true"), () => ci.step("Lint", "true")]);
};
`,
		});

		let result = await ciCheck.run(context);
		expect(result.status).toBe("fail");
		expect(result.findings).toEqual(['"Lint" names more than one step']);
	});

	test("fails when the script has no default export or throws while listing", async () => {
		let missing = await fixture({ [SCRIPT]: "export const steps = [];\n" });
		let throwing = await fixture({
			[SCRIPT]: `export default async () => { throw new Error("no such workspace"); };\n`,
		});

		let first = await ciCheck.run(missing);
		let second = await ciCheck.run(throwing);
		expect([first.status, second.status]).toEqual(["fail", "fail"]);
		expect(first.findings[0]).toContain("must default-export a CI script");
		expect(second.findings).toEqual(["the script threw: Error: no such workspace"]);
	});

	test("reads the path ci.script configures, and skips without a script", async () => {
		let configured = await fixture(
			{ "ci/main.ts": `export default async (ci) => { await ci.step("Lint", "true"); };\n` },
			{ config: { ci: { script: "ci/main.ts" } } },
		);
		let none = await fixture({});

		expect((await ciCheck.run(configured)).status).toBe("pass");
		expect(await ciCheck.run(none)).toMatchObject({
			status: "skip",
			message: "No CI script at .config/sdxc/ci.ts",
		});
	});
});
