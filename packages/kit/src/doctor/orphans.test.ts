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

	test("counts a test's imports, a root config's paths and the declaration modules", async () => {
		let context = await fixture({
			"vite.config.ts":
				'export default { test: { alias: { "cloudflare:workers": "app/test/cloudflare-workers.ts" } } };\n',
			"app/test/cloudflare-workers.ts": "export const env = {};\n",
			"app/test/database.ts": "export function migrate() {}\n",
			"app/initializers/database.test.ts":
				'import { migrate } from "~/app/test/database";\nmigrate();\n',
			"app/emails/index.ts": "export default {};\n",
			"app/mcp/tools/index.ts": "export default {};\n",
			"app/mcp/resources/index.ts": "export default {};\n",
		});

		let result = await orphansCheck.run(context);

		expect(result.findings).toEqual([]);
		expect(result.status).toBe("pass");
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
