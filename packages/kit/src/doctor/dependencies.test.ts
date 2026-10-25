/**
 * The `dependencies` check: inward edges pass, cycles and outward edges warn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { dependenciesCheck } from "./dependencies.js";
import { fixture, removeFixtures } from "./fixture.js";

afterEach(removeFixtures);

describe("dependenciesCheck", () => {
	test("passes when http imports models", async () => {
		let context = await fixture({
			"app/models/post.ts": `export function load() {\n\treturn 1;\n}\n`,
			"app/http/controllers/show.ts": `import { load } from "../../models/post.js";\nexport const show = load;\n`,
		});
		expect((await dependenciesCheck.run(context)).status).toBe("pass");
	});

	test("passes the layout a router needs: lazy controllers, contracts, views and middleware", async () => {
		let context = await fixture({
			"routes/web.ts": "export default { home: '/' };\n",
			"resources/layouts/document.tsx": "export function Document() {}\n",
			"app/http/middleware/timing.ts": "export default function timing() {}\n",
			"app/initializers/health.ts":
				'import type { AppContext } from "~/app/initializers/router";\nexport let health: AppContext | null = null;\n',
			"app/http/controllers/home.tsx":
				'import { Document } from "~/resources/layouts/document";\nimport { health } from "~/app/initializers/health";\nimport routes from "~/routes/web";\nexport default [Document, health, routes];\n',
			"app/initializers/router.tsx":
				'import timing from "~/app/http/middleware/timing";\nimport routes from "~/routes/web";\nexport type AppContext = typeof routes;\nexport let router = [timing, () => import("~/app/http/controllers/home")];\n',
		});

		let result = await dependenciesCheck.run(context);

		expect(result.findings).toEqual([]);
		expect(result.status).toBe("pass");
	});

	test("warns on an outward import and a cycle", async () => {
		let context = await fixture({
			"app/http/controllers/show.ts": `import { load } from "../../models/post.js";\nexport const show = load;\n`,
			"app/models/post.ts": `import { show } from "../http/controllers/show.js";\nexport function load() {\n\treturn show;\n}\n`,
		});

		let result = await dependenciesCheck.run(context);

		expect(result.status).toBe("warn");
		expect(result.findings.some((finding) => finding.includes("cycle:"))).toBe(true);
		expect(
			result.findings.some((finding) => finding.includes("dependencies must point inward")),
		).toBe(true);
	});
});
