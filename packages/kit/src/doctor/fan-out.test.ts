/**
 * The `fan-out` check over fixture apps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { fanOutCheck } from "./fan-out.js";
import { fixture, removeFixtures } from "./fixture.js";

afterEach(removeFixtures);

describe("fanOutCheck", () => {
	test("passes a module under the fan-out limit", async () => {
		let context = await fixture({
			"app/models/a.ts": "export const a = 1;\n",
			"app/services/run.ts": 'import { a } from "../models/a.js";\nexport const run = a;\n',
		});
		expect((await fanOutCheck.run(context)).status).toBe("pass");
	});

	test("leaves lazy() mappings out of the count", async () => {
		let context = await fixture(
			{
				"app/models/a.ts": "export const a = 1;\n",
				"app/http/controllers/b.ts": "export default 1;\n",
				"app/http/controllers/c.ts": "export default 1;\n",
				"app/initializers/router.ts":
					'import { a } from "~/app/models/a";\nexport let map = [a, () => import("~/app/http/controllers/b"), () => import("~/app/http/controllers/c")];\n',
			},
			{ config: { doctor: { fanOut: { max: 1 } } } },
		);
		expect((await fanOutCheck.run(context)).status).toBe("pass");
	});

	test("warns when imports exceed doctor.fanOut.max", async () => {
		let context = await fixture(
			{
				"app/models/a.ts": "export const a = 1;\n",
				"app/models/b.ts": "export const b = 1;\n",
				"app/services/hub.ts":
					'import { a } from "../models/a.js";\nimport { b } from "../models/b.js";\nexport const hub = [a, b];\n',
			},
			{ config: { doctor: { fanOut: { max: 1 } } } },
		);
		let result = await fanOutCheck.run(context);
		expect(result.status).toBe("warn");
		expect(result.findings[0]).toContain("hub.ts");
	});
});
