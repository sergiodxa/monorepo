/**
 * The `routes` check over fixture apps: routes every router maps through `lazy()` pass, an
 * unmapped route and a mapping written without `lazy()` warn, and no `routes/` folder skips.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { fixture, removeFixtures } from "./fixture.js";
import { routesCheck } from "./routes.js";

afterEach(removeFixtures);

/** A contract with three pages. */
const CONTRACT = [
	'import { get, route } from "remix/routes";',
	"",
	"export default route({",
	'\thome: get("/"),',
	'\tabout: get("/about"),',
	'\tpricing: get("/pricing"),',
	"});",
	"",
].join("\n");

/** A router initializer mapping `maps`, one `router.map(…)` statement each. */
function initializer(maps: string[]): string {
	return [
		'import { lazy } from "@sdxc/lazy-route";',
		'import { createRouter } from "remix/router";',
		"",
		'import about from "~/app/http/controllers/about";',
		'import routes from "~/routes/web";',
		"",
		"export function createWebRouter() {",
		"\tlet router = createRouter({ middleware: [] });",
		...maps.map((map) => `\t${map}`),
		"\treturn router;",
		"}",
		"",
	].join("\n");
}

/** The controllers the initializers import. */
const CONTROLLERS = {
	"app/http/controllers/home.ts": "export default {};\n",
	"app/http/controllers/about.ts": "export default {};\n",
	"app/http/controllers/pricing.ts": "export default {};\n",
};

describe("routesCheck", () => {
	test("passes when every route is mapped through lazy()", async () => {
		let context = await fixture({
			...CONTROLLERS,
			"routes/web.ts": CONTRACT,
			"app/initializers/router.ts": initializer([
				'router.map(routes.home, lazy(() => import("~/app/http/controllers/home")));',
				'router.map(routes.about, lazy(() => import("~/app/http/controllers/about")));',
				'router.map(routes.pricing, lazy(() => import("~/app/http/controllers/pricing")));',
			]),
		});

		expect(await routesCheck.run(context)).toMatchObject({
			status: "pass",
			message: "3 routes are mapped through lazy()",
		});
	});

	test("warns on a route no router maps and on a mapping without lazy()", async () => {
		let context = await fixture({
			...CONTROLLERS,
			"routes/web.ts": CONTRACT,
			"app/initializers/router.ts": initializer([
				'router.map(routes.home, lazy(() => import("~/app/http/controllers/home")));',
				"router.map(routes.about, about);",
			]),
		});

		expect(await routesCheck.run(context)).toMatchObject({
			status: "warn",
			message: "Found 1 route no router maps and 1 mapping without lazy()",
			findings: [
				"GET /pricing (routes/web.ts pricing) is mapped by no router",
				"app/initializers/router.ts maps routes.about, about without lazy()",
			],
		});
	});

	test("passes a controller object whose actions each load through lazy() or import()", async () => {
		let context = await fixture({
			...CONTROLLERS,
			"routes/web.ts": [
				'import { form, get, route } from "remix/routes";',
				"",
				'export default route({ board: form("/board"), mcp: get("/mcp") });',
				"",
			].join("\n"),
			"app/initializers/router.ts": initializer([
				"router.map(routes.board, {",
				"\tactions: {",
				'\t\tindex: lazy(() => import("~/app/http/controllers/home")),',
				'\t\taction: lazy(() => import("~/app/http/controllers/pricing"), []),',
				"\t},",
				"});",
				"router.map(routes.mcp, {",
				"\tmiddleware: [],",
				'\thandler: async (ctx) => (await import("~/app/http/controllers/home")).default(ctx),',
				"});",
			]),
		});

		expect(await routesCheck.run(context)).toMatchObject({
			status: "pass",
			message: "3 routes are mapped through lazy()",
		});
	});

	test("names the one action of a controller object that loads with the router", async () => {
		let context = await fixture({
			...CONTROLLERS,
			"routes/web.ts": [
				'import { form, route } from "remix/routes";',
				"",
				'export default route({ board: form("/board") });',
				"",
			].join("\n"),
			"app/initializers/router.ts": initializer([
				"router.map(routes.board, {",
				"\tactions: {",
				'\t\tindex: lazy(() => import("~/app/http/controllers/home")),',
				"\t\taction: { middleware: [], handler: about },",
				"\t},",
				"});",
			]),
		});

		expect(await routesCheck.run(context)).toMatchObject({
			status: "warn",
			findings: ["app/initializers/router.ts maps routes.board action action without lazy()"],
		});
	});

	test("skips a project without routes/", async () => {
		expect((await routesCheck.run(await fixture({}))).status).toBe("skip");
	});
});
