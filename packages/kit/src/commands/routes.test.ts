/**
 * Tests `sdxc routes` as a developer and an agent meet it: a table per contract under the
 * router's global middleware, `--json` as an array that parses, and diagnostics on stderr only.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { afterEach, describe, expect, test } from "vitest";

import { createSDXC } from "../cli.js";

/** Fixture projects created by the current test, removed after it. */
const PROJECTS: string[] = [];

afterEach(async () => {
	let created = PROJECTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A project with one contract, one router and one controller with a page chain. */
async function project(): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-routes-command-"));
	PROJECTS.push(root);
	let files: Record<string, string> = {
		"package.json": '{ "name": "app" }\n',
		"routes/web.ts": [
			'import { form, get, route } from "remix/routes";',
			"",
			"export default route({",
			'\thome: get("/"),',
			'\tlogin: form("/login"),',
			"\tbroken: `/${1}`,",
			"});",
			"",
		].join("\n"),
		"app/http/controllers/home.tsx": [
			'import page from "~/app/http/middleware/page";',
			"",
			"export default createAction(routes.home, { middleware: page, handler: () => null });",
			"",
		].join("\n"),
		"app/http/middleware/page.ts": "export default createMiddleware();\n",
		"app/initializers/router.ts": [
			'import { lazy } from "@sdxc/lazy-route";',
			'import { createRouter } from "remix/router";',
			"",
			'import routes from "~/routes/web";',
			"",
			"export function createWebRouter() {",
			"\tlet router = createRouter({ middleware: [log(logger)] });",
			'\trouter.map(routes.home, lazy(() => import("~/app/http/controllers/home"), [requireUser]));',
			"\treturn router;",
			"}",
			"",
		].join("\n"),
	};
	for (let [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

describe("sdxc routes", () => {
	test("prints a table per contract under the router's global middleware", async () => {
		let root = await project();

		let run = await invoke(createSDXC(), ["routes"], { cwd: root });

		expect(run.code).toBe(0);
		expect(run.stdout).toBe(
			[
				"Router app/initializers/router.ts",
				"  log(logger)",
				"",
				"routes/web.ts",
				"  METHOD  PATTERN  NAME          CONTROLLER                     MIDDLEWARE",
				"  GET     /        home          app/http/controllers/home.tsx  requireUser, page",
				"  GET     /login   login.index   (not mapped)",
				"  POST    /login   login.action  (not mapped)",
				"",
			].join("\n"),
		);
		expect(run.stderr).toBe(
			"routes/web.ts: `broken` is declared with code sdxc routes does not evaluate; it is left out\n",
		);
	});

	test("--json prints an array an agent parses, with every field of each route", async () => {
		let root = await project();

		let run = await invoke(createSDXC(), ["routes", "--json"], { cwd: root });

		expect(run.code).toBe(0);
		let routes = JSON.parse(run.stdout) as unknown[];
		expect(routes).toHaveLength(3);
		expect(routes[0]).toEqual({
			method: "GET",
			pattern: "/",
			contract: "routes/web.ts",
			name: "home",
			router: "app/initializers/router.ts",
			controller: { file: "app/http/controllers/home.tsx", export: "default" },
			middleware: {
				router: [{ name: "log(logger)", from: null }],
				guards: [{ name: "requireUser", from: null }],
				controller: [{ name: "page", from: "app/http/middleware/page.ts" }],
			},
		});
		expect(routes[1]).toMatchObject({ name: "login.index", router: null, controller: null });
	});
});
