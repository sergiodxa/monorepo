/**
 * How `sdxc middleware` expands each chain module and counts the routes that run it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, test } from "vite-plus/test";

import { formatMiddleware, listMiddleware } from "./chains.js";

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	await Promise.all(DIRECTORIES.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A project whose router runs `log()`, and whose one page runs the `page` chain. */
async function project(): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-chains-"));
	DIRECTORIES.push(root);
	let files: Record<string, string> = {
		"package.json": '{ "name": "app" }\n',
		"routes/web.ts":
			'import { get, route } from "remix/routes";\n\nexport default route({ home: get("/") });\n',
		"app/http/middleware/page.ts": [
			'import { cop } from "remix/middleware/cop";',
			'import { createMiddleware } from "remix/router";',
			"",
			'import access from "~/app/http/middleware/access";',
			"",
			"export default createMiddleware(cop(), access);",
			"",
		].join("\n"),
		"app/http/middleware/access.ts": "export default function access() {}\n",
		"app/http/controllers/home.tsx": [
			'import page from "~/app/http/middleware/page";',
			"",
			"export default createAction(routes.home, { middleware: page, handler: () => null });",
			"",
		].join("\n"),
		"app/initializers/router.ts": [
			'import { lazy } from "@sdxc/lazy-route";',
			'import { log } from "@sdxc/logger/middleware";',
			'import { createRouter } from "remix/router";',
			"",
			'import routes from "~/routes/web";',
			"",
			"export let router = createRouter({ middleware: [log()] });",
			'router.map(routes.home, lazy(() => import("~/app/http/controllers/home")));',
			"",
		].join("\n"),
	};
	for (let [path, content] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), content);
	}
	return root;
}

describe("listMiddleware", () => {
	test("expands a chain in run order and counts a member's routes through it", async () => {
		let listing = await listMiddleware(await project());

		expect(listing.routers).toEqual([
			{
				file: "app/initializers/router.ts",
				middleware: [{ name: "log()", from: "@sdxc/logger/middleware" }],
			},
		]);
		expect(listing.modules).toEqual([
			{ file: "app/http/middleware/access.ts", kind: "middleware", middleware: [], routes: 1 },
			{
				file: "app/http/middleware/page.ts",
				kind: "chain",
				middleware: [
					{ name: "cop()", from: "remix/middleware/cop" },
					{ name: "access", from: "app/http/middleware/access.ts" },
				],
				routes: 1,
			},
		]);
		expect(formatMiddleware(listing)).toContain(
			"app/http/middleware/page.ts, a chain 1 route run:\n  1. cop()   remix/middleware/cop\n",
		);
	});
});
