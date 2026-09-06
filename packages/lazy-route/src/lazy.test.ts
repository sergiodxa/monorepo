/**
 * Covers `lazy()` against a real router: that the module loads on the first matching
 * request and only once, that a single route and a route map both work from the same
 * stand-in, that the middleware a module declares still runs in order, and that a
 * module pointed at the wrong kind of target says so.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext } from "remix/router";

import { createAction, createController, createRouter } from "remix/router";
import { form, get as getRoute, route } from "remix/routes";
import { describe, expect, expectTypeOf, test } from "vitest";

import { lazy } from "./lazy.js";

const ROUTES = route({
	home: getRoute("/"),
	bookmark: getRoute("/bookmarks/:id"),
	form: form("/form"),
});

/** Records the order middleware and handlers ran in, so a test can assert the chain. */
function tracer() {
	let steps: string[] = [];

	function step(name: string): Middleware {
		return (_context, next) => {
			steps.push(name);
			return next();
		};
	}

	return { steps, step };
}

/** Names a middleware that answers on its own instead of continuing the chain. */
function shortCircuit(body: string): Middleware {
	return () => new Response(body);
}

function get(path: string, init?: RequestInit) {
	return new Request(new URL(path, "https://example.com"), init);
}

describe("lazy", () => {
	test("does not load the module until a request matches", async () => {
		let loads = 0;

		let router = createRouter();
		router.map(
			ROUTES.home,
			lazy(async () => {
				loads += 1;
				return { default: () => new Response("home") };
			}),
		);

		expect(loads).toBe(0);

		let response = await router.fetch(get("/"));

		expect(await response.text()).toBe("home");
		expect(loads).toBe(1);
	});

	test("loads the module once across requests", async () => {
		let loads = 0;

		let router = createRouter();
		router.map(
			ROUTES.home,
			lazy(async () => {
				loads += 1;
				return { default: () => new Response("home") };
			}),
		);

		await router.fetch(get("/"));
		await router.fetch(get("/"));
		await router.fetch(get("/"));

		expect(loads).toBe(1);
	});

	test("gives the loaded handler the matched params", async () => {
		let router = createRouter();
		router.map(
			ROUTES.bookmark,
			lazy(async () => ({
				default: (context: RequestContext<{ id: string }>) => new Response(context.params.id),
			})),
		);

		let response = await router.fetch(get("/bookmarks/42"));

		expect(await response.text()).toBe("42");
	});

	test("accepts a loader that resolves the handler rather than a module", async () => {
		let router = createRouter();
		router.map(
			ROUTES.home,
			lazy(async () => () => new Response("named")),
		);

		expect(await (await router.fetch(get("/"))).text()).toBe("named");
	});

	test("runs the middleware an action declares, before its handler", async () => {
		let { steps, step } = tracer();

		let router = createRouter();
		router.map(
			ROUTES.home,
			lazy(async () => ({
				default: {
					middleware: [step("first"), step("second")],
					handler: () => {
						steps.push("handler");
						return new Response("home");
					},
				},
			})),
		);

		await router.fetch(get("/"));

		expect(steps).toEqual(["first", "second", "handler"]);
	});

	test("runs router middleware before the module loads", async () => {
		let { steps, step } = tracer();

		let router = createRouter({ middleware: [step("router")] });
		router.map(
			ROUTES.home,
			lazy(async () => {
				steps.push("load");
				return { default: () => new Response("home") };
			}),
		);

		await router.fetch(get("/"));

		expect(steps).toEqual(["router", "load"]);
	});

	test("lets a declared middleware answer without reaching the handler", async () => {
		let reached = false;

		let router = createRouter();
		router.map(
			ROUTES.home,
			lazy(async () => ({
				default: {
					middleware: [shortCircuit("denied")],
					handler: () => {
						reached = true;
						return new Response("home");
					},
				},
			})),
		);

		let response = await router.fetch(get("/"));

		expect(await response.text()).toBe("denied");
		expect(reached).toBe(false);
	});

	test("maps every action of a controller from one stand-in", async () => {
		let router = createRouter();
		router.map(
			ROUTES.form,
			lazy(async () => ({
				default: {
					actions: {
						index: () => new Response("rendered"),
						action: () => new Response("submitted"),
					},
				},
			})),
		);

		expect(await (await router.fetch(get("/form"))).text()).toBe("rendered");
		expect(await (await router.fetch(get("/form", { method: "POST" }))).text()).toBe("submitted");
	});

	test("runs controller middleware ahead of the action's own", async () => {
		let { steps, step } = tracer();

		let router = createRouter();
		router.map(
			ROUTES.form,
			lazy(async () => ({
				default: {
					middleware: [step("controller")],
					actions: {
						index: {
							middleware: [step("action")],
							handler: () => {
								steps.push("handler");
								return new Response("rendered");
							},
						},
						action: () => new Response("submitted"),
					},
				},
			})),
		);

		await router.fetch(get("/form"));

		expect(steps).toEqual(["controller", "action", "handler"]);
	});

	test("loads a controller once for all of its actions", async () => {
		let loads = 0;

		let router = createRouter();
		router.map(
			ROUTES.form,
			lazy(async () => {
				loads += 1;
				return {
					default: {
						actions: {
							index: () => new Response("rendered"),
							action: () => new Response("submitted"),
						},
					},
				};
			}),
		);

		await router.fetch(get("/form"));
		await router.fetch(get("/form", { method: "POST" }));

		expect(loads).toBe(1);
	});

	test("reports a controller that was mapped to a single route", async () => {
		let router = createRouter();
		router.map(
			ROUTES.home,
			// @ts-expect-error -- the map call rejects this too; the runtime message is what a
			// looser caller, or a module whose type drifted from the route, still gets.
			lazy(async () => ({ default: { actions: { index: () => new Response("home") } } })),
		);

		await expect(router.fetch(get("/"))).rejects.toThrow("Loaded a controller for a single route");
	});

	test("reports an action that was mapped to a route map", async () => {
		let router = createRouter();
		router.map(
			ROUTES.form,
			// @ts-expect-error -- rejected at the map call; asserting the runtime message too.
			lazy(async () => ({ default: () => new Response("rendered") })),
		);

		await expect(router.fetch(get("/form"))).rejects.toThrow("Loaded an action for a route map");
	});

	test("reports an action a controller is missing", async () => {
		let router = createRouter();
		router.map(
			ROUTES.form,
			// @ts-expect-error -- a missing action is a type error at the map call, which is
			// where a static map would also catch it; this covers the deferred check behind it.
			lazy(async () => ({
				default: { actions: { index: () => new Response("rendered") } },
			})),
		);

		expect(await (await router.fetch(get("/form"))).text()).toBe("rendered");
		await expect(router.fetch(get("/form", { method: "POST" }))).rejects.toThrow(
			"Missing action `action` in loaded controller",
		);
	});

	test("reports a module that is neither an action nor a controller", async () => {
		let router = createRouter();
		router.map(
			ROUTES.home,
			// @ts-expect-error -- `lazy()` rejects a module that is not a handler at all.
			lazy(async () => ({ default: { handler: "not a function" } })),
		);

		await expect(router.fetch(get("/"))).rejects.toThrow(
			"Expected a request handler function or action object",
		);
	});

	test("reports a middleware that neither answers nor continues", async () => {
		let router = createRouter();
		router.map(
			ROUTES.home,
			lazy(async () => ({
				default: {
					middleware: [() => undefined as unknown as Response],
					handler: () => new Response("home"),
				},
			})),
		);

		await expect(router.fetch(get("/"))).rejects.toThrow(
			"Middleware must return a Response or call next()",
		);
	});

	test("reports a middleware that continues twice", async () => {
		let router = createRouter();
		router.map(
			ROUTES.home,
			lazy(async () => ({
				default: {
					middleware: [
						async (_context: RequestContext, next: () => Promise<Response>) => {
							await next();
							return next();
						},
					],
					handler: () => new Response("home"),
				},
			})),
		);

		await expect(router.fetch(get("/"))).rejects.toThrow("next() called multiple times");
	});

	test("carries an action written with `createAction` through to the router", async () => {
		let action = createAction(ROUTES.bookmark, (context) => new Response(context.params.id));

		expectTypeOf(lazy(async () => ({ default: action }))).toEqualTypeOf<typeof action>();

		let router = createRouter();
		router.map(
			ROUTES.bookmark,
			lazy(async () => ({ default: action })),
		);

		expect(await (await router.fetch(get("/bookmarks/7"))).text()).toBe("7");
	});

	test("carries a controller written with `createController` through to the router", async () => {
		let controller = createController(ROUTES.form, {
			actions: {
				index: () => new Response("rendered"),
				action: () => new Response("submitted"),
			},
		});

		expectTypeOf(lazy(async () => ({ default: controller }))).toEqualTypeOf<typeof controller>();

		let router = createRouter();
		router.map(
			ROUTES.form,
			lazy(async () => ({ default: controller })),
		);

		expect(await (await router.fetch(get("/form"))).text()).toBe("rendered");
		expect(await (await router.fetch(get("/form", { method: "POST" }))).text()).toBe("submitted");
	});
});
