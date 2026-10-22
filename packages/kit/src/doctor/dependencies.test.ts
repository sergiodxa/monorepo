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
