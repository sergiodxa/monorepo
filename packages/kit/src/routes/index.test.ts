/**
 * `listRoutes` over the `app` template and over a project written with every shape a contract
 * and a router initializer take: prefixes, composed contracts, spreads, form and resource routes,
 * guards held in arrays, named exports, helpers that return `lazy()` and inline controllers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, test } from "vite-plus/test";

import { defaultPackageRoot } from "../create/templates.js";

import type { RouteEntry } from "./index.js";

import { listRoutes } from "./index.js";

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	let created = DIRECTORIES.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A project holding `files`, by path relative to its root. */
async function project(files: Record<string, string>): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-routes-"));
	DIRECTORIES.push(root);
	await writeFile(join(root, "package.json"), '{ "name": "@acme/app" }\n');
	for (let [path, source] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), source);
	}
	return root;
}

/** Each route as `METHOD pattern name -> controller [middleware]`, for a readable expectation. */
function summary(routes: readonly RouteEntry[]): string[] {
	return routes.map((route) => {
		let controller =
			route.controller === null
				? "unmapped"
				: `${route.controller.file ?? "?"}${route.controller.export === "default" ? "" : `#${route.controller.export ?? "inline"}`}`;
		let middleware = [...route.middleware.guards, ...route.middleware.controller]
			.map((entry) => entry.name)
			.join(", ");
		return `${route.method} ${route.pattern} ${route.name} -> ${controller} [${middleware}]`;
	});
}

/** A project that uses every shape the reader follows. */
const FILES: Record<string, string> = {
	"routes/admin.ts": [
		'import { get, resources, route } from "remix/routes";',
		"",
		"export default route({",
		'\tdashboard: get("/"),',
		'\tposts: resources("/posts", { only: ["index", "show"], param: "slug" }),',
		"});",
		"",
	].join("\n"),
	"routes/web.ts": [
		'import { del, form, get, post, resources, route } from "remix/routes";',
		"",
		'import admin from "~/routes/admin";',
		"",
		"/** The pages. */",
		"export default route({",
		'\thome: get("/"),',
		'\tlogin: form("/login"),',
		"\tteam: {",
		'\t\t...resources("/teams", { only: ["index", "new"] }),',
		'\t\tleave: del("/teams/:id/membership"),',
		"\t},",
		'\tactivityPub: route("/activitypub", { inbox: post("/inbox") }),',
		"\tdynamic: `/${1 + 1}`,",
		'\tsearch: get("/search"),',
		'\tforgotten: get("/forgotten"),',
		'\tadmin: route("/admin", admin),',
		"});",
		"",
	].join("\n"),
	"app/http/middleware/page.ts": [
		'import { createMiddleware } from "remix/router";',
		"",
		"export default createMiddleware();",
		"",
	].join("\n"),
	"app/http/controllers/home.tsx": [
		'import { createAction } from "remix/router";',
		"",
		'import page from "~/app/http/middleware/page";',
		'import routes from "~/routes/web";',
		"",
		"export default createAction(routes.home, { middleware: page, handler: () => null });",
		"",
	].join("\n"),
	"app/http/controllers/auth.tsx": [
		'import { createController } from "remix/router";',
		"",
		'import routes from "~/routes/web";',
		"",
		"export const login = createController(routes.login, {",
		"\tmiddleware: [requireGuest()],",
		"\tactions: {",
		"\t\tindex: () => null,",
		"\t\taction: { middleware: [verifyCSRF], handler: () => null },",
		"\t},",
		"});",
		"",
	].join("\n"),
	"app/http/controllers/teams.ts": "export default {};\n",
	"app/http/controllers/search.ts": "export function searchFor(term: string) { return term; }\n",
	"app/http/controllers/admin.ts": "export default {};\n",
	"app/initializers/router.tsx": [
		'import type { Middleware } from "remix/router";',
		"",
		'import { lazy } from "@sdxc/lazy-route";',
		'import { log } from "@sdxc/logger/middleware";',
		'import { createRouter } from "remix/router";',
		"",
		'import serverTiming from "~/app/http/middleware/server-timing";',
		'import routes from "~/routes/web";',
		"",
		"/** Who may see the admin. */",
		'const ADMIN: Middleware[] = [requireUser, requireRole("admin")];',
		"",
		"/** The admin's write routes add an audit. */",
		"const ADMIN_WRITES: Middleware[] = [...ADMIN, audit];",
		"",
		"/** The search page by term. */",
		"function searchPage(term: string) {",
		'\treturn lazy(() => import("~/app/http/controllers/search").then((it) => it.searchFor(term)));',
		"}",
		"",
		"export function createWebRouter() {",
		"\tlet router = createRouter<{ x: string }>({",
		"\t\tmiddleware: [log(logger), serverTiming(), async (ctx, next) => next()],",
		"\t\tdefaultHandler: () => <p>Not found</p>,",
		"\t});",
		'\trouter.map(routes.home, lazy(() => import("~/app/http/controllers/home")));',
		'\trouter.map(routes.login, lazy(() => import("../http/controllers/auth").then((it) => it.login)));',
		'\trouter.map(routes.team, lazy(() => import("~/app/http/controllers/teams"), ADMIN));',
		"\trouter.map(routes.activityPub, {",
		"\t\tmiddleware: [federate],",
		"\t\tactions: {",
		"\t\t\tinbox: { middleware: [verifySignature], handler: () => null },",
		"\t\t},",
		"\t});",
		'\trouter.map(routes.search, searchPage("all"));',
		'\trouter.map(routes.admin, lazy(() => import("~/app/http/controllers/admin"), [...ADMIN_WRITES]));',
		"\trouter.map(somewhere.else, () => null);",
		"\treturn router;",
		"}",
		"",
	].join("\n"),
	"app/http/middleware/server-timing.ts": "export default function serverTiming() {}\n",
};

describe("listRoutes", () => {
	test("lists every route of the app template with its controller and chain", async () => {
		let listing = await listRoutes(join(defaultPackageRoot(), "templates/app"));
		expect(listing.diagnostics).toEqual([]);
		expect(summary(listing.routes)).toEqual([
			"GET / home -> app/http/controllers/home.tsx [page]",
			"GET /robots.txt robots -> app/http/controllers/robots.ts []",
			"GET /sitemap.xml sitemap -> app/http/controllers/sitemap.ts []",
			"ANY /*path notFound -> app/http/controllers/not-found.tsx [page]",
			"GET /api/health api.health -> app/http/controllers/api/health.tsx [api]",
			"GET /api/openapi.json api.openapi -> app/http/controllers/api/openapi.tsx [api]",
			"ANY /api/*path api.notFound -> app/http/controllers/api/not-found.tsx [api]",
			"POST /mcp mcp -> app/http/controllers/mcp.tsx [api]",
		]);
		let home = listing.routes[0];
		expect(home?.contract).toBe("routes/web.ts");
		expect(home?.router).toBe("app/initializers/router.tsx");
		expect(home?.middleware.router.slice(0, 4)).toEqual([
			{ name: "asyncContext()", from: "remix/middleware/async-context" },
			{ name: "log(logger)", from: "@sdxc/logger/middleware" },
			{ name: "trace()", from: "@sdxc/trace-context/middleware" },
			{ name: "serverTiming()", from: "app/http/middleware/server-timing.ts" },
		]);
		expect(home?.middleware.controller).toEqual([
			{ name: "page", from: "app/http/middleware/page.ts" },
		]);
	});

	test("follows prefixes, composed contracts, spreads, guards and every handler shape", async () => {
		let listing = await listRoutes(await project(FILES));
		expect(summary(listing.routes)).toEqual([
			"GET / home -> app/http/controllers/home.tsx [page]",
			"GET /login login.index -> app/http/controllers/auth.tsx#login [requireGuest()]",
			"POST /login login.action -> app/http/controllers/auth.tsx#login [requireGuest(), verifyCSRF]",
			'GET /teams team.index -> app/http/controllers/teams.ts [requireUser, requireRole("admin")]',
			'GET /teams/new team.new -> app/http/controllers/teams.ts [requireUser, requireRole("admin")]',
			'DELETE /teams/:id/membership team.leave -> app/http/controllers/teams.ts [requireUser, requireRole("admin")]',
			"POST /activitypub/inbox activityPub.inbox -> app/initializers/router.tsx#inline [federate, verifySignature]",
			"GET /search search -> app/http/controllers/search.ts#searchFor []",
			"GET /forgotten forgotten -> unmapped []",
			'GET /admin admin.dashboard -> app/http/controllers/admin.ts [requireUser, requireRole("admin"), audit]',
			'GET /admin/posts admin.posts.index -> app/http/controllers/admin.ts [requireUser, requireRole("admin"), audit]',
			'GET /admin/posts/:slug admin.posts.show -> app/http/controllers/admin.ts [requireUser, requireRole("admin"), audit]',
		]);
		expect(listing.routes[0]?.middleware.router).toEqual([
			{ name: "log(logger)", from: "@sdxc/logger/middleware" },
			{ name: "serverTiming()", from: "app/http/middleware/server-timing.ts" },
			{ name: "(inline)", from: null },
		]);
		expect(listing.diagnostics).toEqual([
			"routes/web.ts: `dynamic` is declared with code sdxc routes does not evaluate; it is left out",
			"app/initializers/router.tsx: somewhere.else is not a route sdxc routes can read",
		]);
	});

	test("a project without route contracts lists nothing", async () => {
		let listing = await listRoutes(await project({}));
		expect(listing).toEqual({ routes: [], routers: [], diagnostics: [] });
	});
});
