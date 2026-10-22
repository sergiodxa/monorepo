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
import { afterEach, describe, expect, test } from "vite-plus/test";

import { createSDXC } from "../cli.js";

/** Fixture projects created by the current test, removed after it. */
const PROJECTS: string[] = [];

afterEach(async () => {
	let created = PROJECTS.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A project with one contract, one router and one controller with a page chain, plus `extra`. */
async function project(extra: Record<string, string> = {}): Promise<string> {
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
		...extra,
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

	describe("filters", () => {
		/** Adds an API contract mapped by a second router, a helper its controllers import, and an orphan controller. */
		async function filtered(): Promise<string> {
			return project({
				"routes/api.ts": [
					'import { del, get, post, route } from "remix/routes";',
					"",
					'export default route("/api", {',
					'\tposts: { show: get("/posts/:id"), create: post("/posts"), destroy: del("/posts/:id") },',
					'\tping: "/ping",',
					"});",
					"",
				].join("\n"),
				"app/http/controllers/posts/show.ts": [
					'import { load } from "./shared";',
					"",
					"export default createAction(routes.posts.show, load);",
					"",
				].join("\n"),
				"app/http/controllers/posts/shared.ts": "export function load() {}\n",
				"app/http/controllers/posts/create.ts":
					"export default createAction(routes.posts.create, () => null);\n",
				"app/http/controllers/ping.ts": "export default createAction(routes.ping, () => null);\n",
				"app/http/controllers/orphan.ts": "export default createAction(routes.home, () => null);\n",
				"app/initializers/api.ts": [
					'import { lazy } from "@sdxc/lazy-route";',
					'import { createRouter } from "remix/router";',
					"",
					'import routes from "~/routes/api";',
					"",
					"export const apiRouter = createRouter({ middleware: [cors()] });",
					'apiRouter.map(routes.posts.show, lazy(() => import("~/app/http/controllers/posts/show")));',
					'apiRouter.map(routes.posts.create, lazy(() => import("~/app/http/controllers/posts/create")));',
					'apiRouter.map(routes.ping, lazy(() => import("~/app/http/controllers/ping")));',
					"",
				].join("\n"),
			});
		}

		/** The `name` of every route `sdxc routes --json` prints with `args`. */
		async function names(root: string, args: string[]): Promise<string[]> {
			let run = await invoke(createSDXC(), ["routes", "--json", ...args], { cwd: root });
			expect(run.code).toBe(0);
			return (JSON.parse(run.stdout) as Array<{ name: string }>).map((route) => route.name);
		}

		test("--grep matches name, pattern, method or controller, ignoring case", async () => {
			let root = await filtered();

			expect(await names(root, ["-g", "POSTS.SHOW"])).toEqual(["posts.show"]);
			expect(await names(root, ["--grep", "/posts/:id"])).toEqual(["posts.show", "posts.destroy"]);
			expect(await names(root, ["-g", "delete"])).toEqual(["posts.destroy"]);
			expect(await names(root, ["-g", "controllers/ping"])).toEqual(["ping"]);
		});

		test("--grep reads a regular expression, and text that is none as plain text", async () => {
			let root = await filtered();

			expect(await names(root, ["-g", "^posts\\.(show|create)$"])).toEqual([
				"posts.show",
				"posts.create",
			]);
			expect(await names(root, ["-g", "login("])).toEqual([]);
			expect(await names(root, ["-g", "^/login$"])).toEqual(["login.index", "login.action"]);
		});

		test("--controller takes a file or folder, with or without its folder and extension", async () => {
			let root = await filtered();

			expect(await names(root, ["-c", "posts"])).toEqual(["posts.show", "posts.create"]);
			expect(await names(root, ["-c", "posts/show"])).toEqual(["posts.show"]);
			expect(await names(root, ["-c", "app/http/controllers/posts/create.ts"])).toEqual([
				"posts.create",
			]);
			expect(await names(root, ["-c", "post"])).toEqual([]);
		});

		test("--method keeps routes answering it, ANY included, and --contract one contract", async () => {
			let root = await filtered();

			expect(await names(root, ["--method", "post"])).toEqual([
				"posts.create",
				"ping",
				"login.action",
			]);
			expect(await names(root, ["--contract", "web"])).toEqual([
				"home",
				"login.index",
				"login.action",
			]);
			expect(await names(root, ["--contract", "routes/api.ts", "--method", "delete"])).toEqual([
				"posts.destroy",
				"ping",
			]);
		});

		test("--except-path leaves out whole path segments, and --sort orders what is left", async () => {
			let root = await filtered();

			expect(await names(root, ["--except-path", "/api/posts"])).toEqual([
				"ping",
				"home",
				"login.index",
				"login.action",
			]);
			expect(await names(root, ["--except-path", "/api", "--except-path", "/log"])).toEqual([
				"home",
				"login.index",
				"login.action",
			]);
			expect(await names(root, ["--except-path", "/api,/login", "--sort", "name"])).toEqual([
				"home",
			]);
			expect(await names(root, ["--sort", "name"])).toEqual([
				"home",
				"login.action",
				"login.index",
				"ping",
				"posts.create",
				"posts.destroy",
				"posts.show",
			]);
		});

		test("--unused lists unmapped routes and reports controllers no route maps", async () => {
			let root = await filtered();

			let run = await invoke(createSDXC(), ["routes", "--unused"], { cwd: root });

			expect(run.code).toBe(0);
			expect(run.stdout).toBe(
				[
					"routes/api.ts",
					"  METHOD  PATTERN         NAME           CONTROLLER    MIDDLEWARE",
					"  DELETE  /api/posts/:id  posts.destroy  (not mapped)",
					"",
					"routes/web.ts",
					"  METHOD  PATTERN  NAME          CONTROLLER    MIDDLEWARE",
					"  GET     /login   login.index   (not mapped)",
					"  POST    /login   login.action  (not mapped)",
					"",
				].join("\n"),
			);
			expect(run.stderr).toContain(
				"app/http/controllers/orphan.ts: no route maps this controller\n",
			);
			expect(run.stderr).not.toContain("controllers/home.tsx: no route");
			expect(run.stderr).not.toContain("controllers/posts/shared.ts: no route");
		});

		test("a filter that matches nothing says so, and --json prints an empty array", async () => {
			let root = await filtered();

			let table = await invoke(createSDXC(), ["routes", "-g", "nothing"], { cwd: root });
			let json = await invoke(createSDXC(), ["routes", "-g", "nothing", "--json"], { cwd: root });

			expect(table.stdout).toBe("No routes match.\n");
			expect(json.stdout).toBe("[]\n");
		});

		test("--expanded prints one block per route with every field", async () => {
			let root = await project();

			let run = await invoke(createSDXC(), ["routes", "-E", "-g", "home"], { cwd: root });

			expect(run.stdout).toBe(
				[
					"--[ Route 1 ]----------------------------------------",
					"Method                | GET",
					"Pattern               | /",
					"Name                  | home",
					"Contract              | routes/web.ts",
					"Router                | app/initializers/router.ts",
					"Controller            | app/http/controllers/home.tsx",
					"Router middleware     | log(logger)",
					"Guards                | requireUser",
					"Controller middleware | page",
					"",
				].join("\n"),
			);
		});
	});
});
