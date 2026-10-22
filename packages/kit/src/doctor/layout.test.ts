/**
 * The `layout` check over fixture apps: the layout's folders pass, a folder it has no kind for
 * and an import of `bootstrap/` from outside it warn, and a project without `app/` skips.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vite-plus/test";

import { fixture, removeFixtures } from "./fixture.js";
import { layoutCheck, reachesBootstrap } from "./layout.js";

afterEach(removeFixtures);

describe("layoutCheck", () => {
	test("passes an app whose folders and imports follow the layout", async () => {
		let context = await fixture({
			"app/models/posts.ts": 'import { db } from "~/app/initializers/db";\n',
			"app/initializers/db.ts": "export let db = {};\n",
			"bootstrap/worker.ts": 'export { Counter } from "../app/models/counter";\n',
		});

		expect((await layoutCheck.run(context)).status).toBe("pass");
	});

	test("warns on each folder outside the layout and each import of bootstrap/", async () => {
		let context = await fixture({
			"app/lib/format.ts": "export let format = 1;\n",
			"app/repositories/posts.ts": "export let posts = 1;\n",
			"app/services/counter.ts": 'import { Counter } from "../../bootstrap/worker";\n',
			"routes/web.ts": 'export type { Env } from "~/bootstrap/worker";\n',
			"app/services/counter.test.ts": 'import "../../bootstrap/worker";\n',
			"bootstrap/worker.ts": "export class Counter {}\n",
		});

		let result = await layoutCheck.run(context);

		expect(result.status).toBe("warn");
		expect(result.findings).toEqual([
			"app/lib/ is a folder the app layout has no kind for",
			"app/repositories/ is a folder the app layout has no kind for",
			"app/services/counter.ts imports ../../bootstrap/worker",
			"routes/web.ts imports ~/bootstrap/worker",
		]);
	});

	test("skips a project without app/", async () => {
		expect((await layoutCheck.run(await fixture({}))).status).toBe("skip");
	});
});

describe("reachesBootstrap", () => {
	test("follows relative paths and the alias, and leaves packages alone", () => {
		expect(reachesBootstrap("../bootstrap/worker.ts", "routes/web.ts")).toBe(true);
		expect(reachesBootstrap("../../bootstrap", "app/http/controllers/home.ts")).toBe(false);
		expect(reachesBootstrap("../../../bootstrap", "app/http/controllers/home.ts")).toBe(true);
		expect(reachesBootstrap("bootstrap", "app/models/posts.ts")).toBe(false);
		expect(reachesBootstrap("./bootstrap-helpers", "app/models/posts.ts")).toBe(false);
	});
});
