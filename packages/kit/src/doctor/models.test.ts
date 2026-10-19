/**
 * The `models` check over fixture apps: models the registry imports pass, by static import, on
 * first use or through the alias, a model module it leaves out warns, and helpers beside the
 * models count for nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { fixture, removeFixtures } from "./fixture.js";
import { modelsCheck } from "./models.js";

afterEach(removeFixtures);

/** A model module's source. */
const MODEL =
	'import { createModel } from "@sdxc/data-model";\nexport default createModel(table);\n';

describe("modelsCheck", () => {
	test("passes when the registry imports every model, whichever way it imports it", async () => {
		let context = await fixture({
			"app/models/index.ts": [
				'import { createModels } from "@sdxc/data-model";',
				'import Posts from "./posts.ts";',
				"export default createModels({",
				"\tposts: Posts,",
				'\tusers: () => import("./users"),',
				'\tteams: () => import("~/app/models/teams/index"),',
				"});",
			].join("\n"),
			"app/models/posts.ts": MODEL,
			"app/models/users.ts": MODEL,
			"app/models/teams/index.ts": MODEL,
			"app/models/posts.test.ts": MODEL,
			"app/models/search.ts": "export function search() {}\n",
		});

		expect(await modelsCheck.run(context)).toMatchObject({ status: "pass", findings: [] });
	});

	test("warns on each model module the registry leaves out", async () => {
		let context = await fixture({
			"app/models/index.ts":
				'import { createModels } from "@sdxc/data-model";\nexport default createModels({});\n',
			"app/models/posts.ts": MODEL,
			"app/models/billing/invoices.ts": MODEL,
		});

		let result = await modelsCheck.run(context);

		expect(result.status).toBe("warn");
		expect(result.findings).toEqual([
			"app/models/billing/invoices.ts creates a model app/models/index.ts does not import",
			"app/models/posts.ts creates a model app/models/index.ts does not import",
		]);
	});

	test("skips a project without a model registry", async () => {
		expect((await modelsCheck.run(await fixture({}))).status).toBe("skip");
	});
});
