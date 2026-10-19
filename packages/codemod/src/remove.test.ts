/**
 * The removals: a property out of a declaration object, the groups it empties, and the
 * statements that name a module, each leaving the lines around it as they were.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { addProperty } from "./property.js";
import { findStatements, removeProperty, removeStatements } from "./remove.js";

describe("removeProperty", () => {
	test("removes a property on its own line, with its comma", () => {
		let source =
			'export default jobs({\n\tdigest: job({ cron: "0 8 * * *" }),\n\tsend: job({}),\n});\n';

		let edit = unwrap(removeProperty("index.ts", source, { call: "jobs", key: "digest" }));

		expect(edit.source).toBe("export default jobs({\n\tsend: job({}),\n});\n");
		expect(edit.changed).toBe(true);
	});

	test("removes an inline property, and the last one with the comma before it", () => {
		let source = "let a = jobs({ one: 1, two: 2, three: 3 });\n";

		let middle = unwrap(removeProperty("a.ts", source, { call: "jobs", key: "two" }));
		let last = unwrap(removeProperty("a.ts", source, { call: "jobs", key: "three" }));

		expect(middle.source).toBe("let a = jobs({ one: 1, three: 3 });\n");
		expect(last.source).toBe("let a = jobs({ one: 1, two: 2 });\n");
	});

	test("prunes the groups it leaves empty, through route() calls", () => {
		let source = [
			"export default route({",
			'\thome: get("/"),',
			'\tposts: route("/posts", {',
			"\t\tadmin: {",
			'\t\t\tshow: get("/:id"),',
			"\t\t},",
			"\t}),",
			"});",
			"",
		].join("\n");

		let edit = unwrap(
			removeProperty("web.ts", source, { call: "route", path: ["posts", "admin"], key: "show" }),
		);

		expect(edit.source).toBe('export default route({\n\thome: get("/"),\n});\n');
	});

	test("undoes addProperty byte for byte", () => {
		let source = 'export default tools({\n\tsearch: tool("search", {}),\n});\n';
		let added = unwrap(
			addProperty("tools.ts", source, { call: "tools", key: "get", value: 'tool("get", {})' }),
		);

		let removed = unwrap(removeProperty("tools.ts", added.source, { call: "tools", key: "get" }));

		expect(removed.source).toBe(source);
	});

	test("fails naming a key or a path that is not declared", () => {
		let source = "export default jobs({ digest: job({}) });\n";

		let missing = removeProperty("index.ts", source, { call: "jobs", key: "send" });
		let path = removeProperty("index.ts", source, { call: "jobs", path: ["trials"], key: "x" });

		expect(isFailure(missing) && missing.error.message).toContain("`send` is not declared");
		expect(isFailure(path) && path.error.message).toContain("`trials` is not an object literal");
	});
});

describe("findStatements and removeStatements", () => {
	let source = [
		'import { lazy } from "@sdxc/lazy-route";',
		"",
		"export function createWebRouter() {",
		"\tlet router = createRouter();",
		'\trouter.map(routes.home, lazy(() => import("~/app/http/controllers/home")));',
		"\trouter.map(",
		"\t\troutes.posts.show,",
		'\t\tlazy(() => import("~/app/http/controllers/posts/show")),',
		"\t);",
		"\treturn router;",
		"}",
		"",
	].join("\n");

	test("finds the innermost statement holding the specifier, across lines", () => {
		let found = unwrap(
			findStatements("router.ts", source, { specifier: "~/app/http/controllers/posts/show" }),
		);

		expect(found.map((statement) => statement.text)).toEqual([
			'router.map(\n\t\troutes.posts.show,\n\t\tlazy(() => import("~/app/http/controllers/posts/show")),\n\t);',
		]);
	});

	test("removes each statement with its lines and leaves the rest", () => {
		let edit = unwrap(
			removeStatements("router.ts", source, { specifier: "~/app/http/controllers/posts/show" }),
		);

		expect(edit.source).toBe(
			[
				'import { lazy } from "@sdxc/lazy-route";',
				"",
				"export function createWebRouter() {",
				"\tlet router = createRouter();",
				'\trouter.map(routes.home, lazy(() => import("~/app/http/controllers/home")));',
				"\treturn router;",
				"}",
				"",
			].join("\n"),
		);
		expect(unwrap(removeStatements("router.ts", source, { specifier: "~/nothing" })).changed).toBe(
			false,
		);
	});
});
