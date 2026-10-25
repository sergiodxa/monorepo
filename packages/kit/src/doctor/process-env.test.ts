/**
 * The `process-env` check over fixture apps and the finder it runs per module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { fixture, removeFixtures } from "./fixture.js";
import { findProcessEnv, processEnvCheck } from "./process-env.js";

afterEach(removeFixtures);

describe("findProcessEnv", () => {
	test("finds process.env reads and leaves other process members alone", () => {
		let source = "let key = process.env.API_KEY;\nlet { HOST } = process.env;\nprocess.exit(1);\n";
		expect(findProcessEnv("a.ts", source).map((found) => found.line)).toEqual([1, 2]);
	});
});

describe("processEnvCheck", () => {
	test("warns on app code and leaves tests out", async () => {
		let context = await fixture({
			"app/services/key.ts": "export let key = process.env.API_KEY;\n",
			"app/services/key.test.ts": 'process.env.TZ = "UTC";\n',
		});
		let result = await processEnvCheck.run(context);
		expect(result.status).toBe("warn");
		expect(result.findings).toEqual(["app/services/key.ts:1: reads process.env"]);
	});

	test("passes app code that imports env from cloudflare:workers", async () => {
		let context = await fixture({
			"app/services/key.ts":
				'import { env } from "cloudflare:workers";\nexport let key = env.API_KEY;\n',
		});
		expect((await processEnvCheck.run(context)).status).toBe("pass");
	});
});
