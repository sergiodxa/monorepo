/**
 * The `orphans` check over fixture apps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { fixture, removeFixtures } from "./fixture.js";
import { orphansCheck } from "./orphans.js";

afterEach(removeFixtures);

describe("orphansCheck", () => {
	test("passes when every non-entry module is imported", async () => {
		let context = await fixture({
			"bootstrap/worker.ts": 'import "../app/initializers/router.js";\n',
			"app/initializers/router.ts": 'import "../models/post.js";\n',
			"app/models/post.ts": "export const post = 1;\n",
		});
		expect((await orphansCheck.run(context)).status).toBe("pass");
	});

	test("warns on an unreferenced service module", async () => {
		let context = await fixture({
			"app/services/unused.ts": "export const unused = 1;\n",
			"app/models/post.ts": "export const post = 1;\n",
		});
		let result = await orphansCheck.run(context);
		expect(result.status).toBe("warn");
		expect(result.findings.some((finding) => finding.includes("unused.ts"))).toBe(true);
	});
});
