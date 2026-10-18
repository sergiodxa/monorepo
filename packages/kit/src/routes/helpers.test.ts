/**
 * The `remix/routes` helper rules `sdxc routes` restates: pattern joining under a prefix, and the
 * routes `form()`, `resources()` and `resource()` expand to with their options.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { Value } from "./modules.js";

import { applyHelper, helperName, joinPatterns } from "./helpers.js";

/** A string value. */
function text(value: string): Value {
	return { kind: "string", value };
}

/** A map value from plain entries. */
function map(entries: Record<string, Value>): Value {
	return { kind: "map", entries: new Map(Object.entries(entries)) };
}

/** Every route under a value as `METHOD pattern` by key path. */
function flatten(value: Value, path: string[] = []): Record<string, string> {
	if (value.kind === "route") return { [path.join(".")]: `${value.method} ${value.pattern}` };
	if (value.kind !== "map") return {};
	return Object.assign(
		{},
		...[...value.entries].map(([key, entry]) => flatten(entry, [...path, key])),
	);
}

/** Records nothing; the helpers report only what a map drops. */
function ignore(): void {}

describe("joinPatterns", () => {
	test("joins with exactly one slash and leaves a root on either side out", () => {
		expect(joinPatterns("/", "/posts")).toBe("/posts");
		expect(joinPatterns("/cms", "/")).toBe("/cms");
		expect(joinPatterns("/cms/", "/articles")).toBe("/cms/articles");
		expect(joinPatterns("/x", "y")).toBe("/x/y");
		expect(joinPatterns("/", "/")).toBe("/");
	});
});

describe("helperName", () => {
	test("reads shorthand and long names from the route modules only", () => {
		expect(helperName("remix/routes", "del")).toBe("DELETE");
		expect(helperName("remix/routes", "createResourcesRoutes")).toBe("resources");
		expect(helperName("~/lib/routes", "get")).toBeNull();
	});
});

describe("applyHelper", () => {
	test("route() joins its prefix onto nested routes, bare patterns and route objects", () => {
		let nested = applyHelper("route", [text("/cms"), map({ home: text("/") })], ignore);
		let defs = map({
			dashboard: applyHelper("GET", [text("/")], ignore),
			nested,
			api: text("/api/*path"),
			explicit: map({ method: text("PATCH"), pattern: text("/x") }),
		});
		expect(flatten(applyHelper("route", [text("/admin"), defs], ignore))).toEqual({
			dashboard: "GET /admin",
			"nested.home": "ANY /admin/cms",
			api: "ANY /admin/api/*path",
			explicit: "PATCH /admin/x",
		});
	});

	test("form() declares a GET index and an action, renamed and with another method", () => {
		expect(flatten(applyHelper("form", [text("/login")], ignore))).toEqual({
			index: "GET /login",
			action: "POST /login",
		});
		let options = map({ formMethod: text("PUT"), names: map({ action: text("save") }) });
		expect(flatten(applyHelper("form", [text("/profile"), options], ignore))).toEqual({
			index: "GET /profile",
			save: "PUT /profile",
		});
	});

	test("resources() expands to its seven actions, narrowed by only or exclude", () => {
		expect(flatten(applyHelper("resources", [text("/posts")], ignore))).toEqual({
			index: "GET /posts",
			new: "GET /posts/new",
			show: "GET /posts/:id",
			create: "POST /posts",
			edit: "GET /posts/:id/edit",
			update: "PUT /posts/:id",
			destroy: "DELETE /posts/:id",
		});
		let only = map({
			param: text("slug"),
			only: { kind: "array", items: [text("show"), text("edit")] },
			names: map({ show: text("view") }),
		});
		expect(flatten(applyHelper("resources", [text("/posts"), only], ignore))).toEqual({
			view: "GET /posts/:slug",
			edit: "GET /posts/:slug/edit",
		});
		let exclude = map({ exclude: { kind: "array", items: [text("show")] } });
		expect(Object.keys(flatten(applyHelper("resources", [text("/p"), exclude], ignore)))).toEqual([
			"index",
			"new",
			"create",
			"edit",
			"update",
			"destroy",
		]);
	});

	test("resource() is singular: no index and no param", () => {
		expect(flatten(applyHelper("resource", [text("/profile")], ignore))).toEqual({
			new: "GET /profile/new",
			show: "GET /profile",
			create: "POST /profile",
			edit: "GET /profile/edit",
			update: "PUT /profile",
			destroy: "DELETE /profile",
		});
	});

	test("an entry it cannot evaluate is reported and left out", () => {
		let reported: string[] = [];
		let value = applyHelper("route", [map({ dynamic: { kind: "opaque" } })], (message) =>
			reported.push(message),
		);
		expect(flatten(value)).toEqual({});
		expect(reported).toEqual([
			"`dynamic` is declared with code sdxc routes does not evaluate; it is left out",
		]);
	});
});
