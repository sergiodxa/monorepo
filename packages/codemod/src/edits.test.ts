/**
 * Exact-output fixtures for every edit: each input under `fixtures/<edit>/` is edited and
 * compared byte for byte with its expected output, which is then scanned again and parsed by
 * `oxc-parser`, so an edit that lands in the wrong place or produces invalid code fails here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isFailure, unwrap } from "@sdxc/result";
import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vitest";

import type { Edit, MoveOptions } from "./index.js";

import {
	addProperty,
	findModuleReferences,
	insertAfterLast,
	moveImports,
	rewriteSpecifiers,
} from "./index.js";

/** One fixture: the edit to run on `<name>.input.<extension>.txt` and how many references it leaves unhandled. */
interface Case {
	name: string;
	extension: string;
	run: (filename: string, source: string) => ReturnType<typeof moveImports>;
	unhandled?: number;
}

/** The directory holding the fixtures of every edit. */
const FIXTURES = join(import.meta.dirname, "fixtures");

/** The default component move every `moveImports` fixture applies unless it says otherwise. */
const MOVE_BUTTON = { from: "sdxc/ui", names: ["Button"], to: "~/components/ui/button.js" };

/** A move of `names` from `sdxc/ui` to a barrel, where several declarations can land together. */
function moveToIndex(names: string[]): MoveOptions {
	return { from: "sdxc/ui", names, to: "~/components/ui/index.js" };
}

/** The job value every `addProperty` fixture inserts, multi-line so its indentation is checked. */
const JOB = "job({\n\tinput: s.object({ accountId: s.string() }),\n})";

/** The fixtures of each edit, keyed by the directory they live in. */
const CASES: Record<string, Case[]> = {
	"rewrite-specifiers": [
		{
			name: "packages",
			extension: "tsx",
			run: (filename, source) =>
				rewriteSpecifiers(
					filename,
					source,
					(reference) =>
						reference.specifier.startsWith("@sdxc/")
							? reference.specifier.replace("@sdxc/", "sdxc/")
							: null,
					{ calls: ["vi.mock"] },
				),
		},
	],
	"move-imports": [
		{ name: "split", extension: "tsx", run: (f, s) => moveImports(f, s, MOVE_BUTTON) },
		{
			name: "all-names",
			extension: "ts",
			run: (f, s) => moveImports(f, s, { ...MOVE_BUTTON, names: ["Button", "Dialog"] }),
		},
		{
			name: "aliases-and-types",
			extension: "ts",
			run: (f, s) => moveImports(f, s, { ...MOVE_BUTTON, names: ["Button", "ButtonProps"] }),
		},
		{
			name: "type-only",
			extension: "ts",
			run: (f, s) => moveImports(f, s, { ...MOVE_BUTTON, names: ["Button", "ButtonProps"] }),
		},
		{
			name: "join-existing",
			extension: "ts",
			run: (f, s) =>
				moveImports(f, s, {
					from: "sdxc/ui",
					names: ["Button", "Popover", "Menu", "Tabs", "ButtonProps"],
					to: "~/components/ui/index.js",
				}),
		},
		{
			name: "multiline",
			extension: "ts",
			run: (f, s) => moveImports(f, s, { ...MOVE_BUTTON, names: ["Button", "Tooltip"] }),
		},
		{
			name: "default-and-namespace",
			extension: "ts",
			run: (f, s) => moveImports(f, s, MOVE_BUTTON),
			unhandled: 2,
		},
		{
			name: "default-import",
			extension: "ts",
			run: (f, s) => moveImports(f, s, moveToIndex(["default", "Button", "ButtonProps"])),
		},
		{
			name: "namespace",
			extension: "ts",
			run: (f, s) => moveImports(f, s, moveToIndex(["*"])),
		},
		{
			name: "merge",
			extension: "ts",
			run: (f, s) =>
				moveImports(
					f,
					s,
					moveToIndex([
						"Button",
						"Dialog",
						"Menu",
						"ButtonProps",
						"DialogProps",
						"Tooltip",
						"Toast",
					]),
				),
		},
		{
			name: "merge-partial",
			extension: "ts",
			run: (f, s) => moveImports(f, s, moveToIndex(["default", "Button", "Menu"])),
		},
		{
			name: "merge-default",
			extension: "ts",
			run: (f, s) => moveImports(f, s, moveToIndex(["default", "Button"])),
		},
		{
			name: "reexport",
			extension: "ts",
			run: (f, s) => moveImports(f, s, { ...MOVE_BUTTON, names: ["Dialog", "ButtonProps"] }),
		},
	],
	"add-property": [
		{
			name: "trailing-comma",
			extension: "ts",
			run: (f, s) =>
				addProperty(f, s, { call: "jobs", path: ["trials"], key: "expire", value: JOB }),
		},
		{
			name: "missing-level",
			extension: "ts",
			run: (f, s) =>
				addProperty(f, s, { call: "jobs", path: ["trials"], key: "expire", value: JOB }),
		},
		{
			name: "nested-route",
			extension: "ts",
			run: (f, s) =>
				addProperty(f, s, {
					call: "route",
					path: ["api", "admin"],
					key: "roles",
					value: 'get("/api/admin/roles")',
				}),
		},
		{
			name: "no-trailing-comma",
			extension: "ts",
			run: (f, s) =>
				addProperty(f, s, {
					call: "tools",
					key: "list-postings",
					value: 'tool({\n  description: "List postings",\n})',
				}),
		},
		{
			name: "empty-object",
			extension: "ts",
			run: (f, s) =>
				addProperty(f, s, {
					call: "resources",
					path: ["postings"],
					key: "one",
					value: "resource()",
				}),
		},
		{
			name: "single-line",
			extension: "ts",
			run: (f, s) => addProperty(f, s, { call: "tools", key: "list", value: "tool()" }),
		},
		{
			name: "later-argument",
			extension: "ts",
			run: (f, s) =>
				addProperty(f, s, {
					call: "fromRoutes",
					argument: 2,
					path: ["admin"],
					key: "users",
					value: "{ index: true }",
				}),
		},
	],
	"insert-after-last": [
		{
			name: "factory",
			extension: "ts",
			run: (f, s) =>
				insertAfterLast(f, s, {
					call: "router.map",
					statement:
						'router.map(routes.contact, () => import("~/app/http/controllers/contact.js"));',
				}),
		},
		{
			name: "module-level",
			extension: "ts",
			run: (f, s) =>
				insertAfterLast(f, s, {
					call: "webRouter.map",
					statement: "webRouter.map(\n    routes.feed,\n    feed,\n);",
				}),
		},
		{
			name: "fallback",
			extension: "ts",
			run: (f, s) =>
				insertAfterLast(f, s, {
					call: "dispatcher.map",
					statement:
						'dispatcher.map(jobs.trials.expire, () => import("~/app/jobs/trials/expire.js"));',
					fallbackAfter: "createJobDispatcher",
				}),
		},
		{
			name: "multiline-statement",
			extension: "ts",
			run: (f, s) =>
				insertAfterLast(f, s, {
					call: "mcp.tools.map",
					statement:
						'mcp.tools.map(\n\ttoolset.fetch,\n\tlazy(() => import("~/app/mcp/tools/fetch.js")),\n);',
				}),
		},
	],
};

/** The text of a fixture file. */
function fixture(directory: string, file: string): string {
	return readFileSync(join(FIXTURES, directory, file), "utf8");
}

/** Fails the test when `source` no longer scans or `oxc-parser` reports a syntax error. */
function expectValid(filename: string, source: string): void {
	let scanned = findModuleReferences(filename, source);
	expect(isFailure(scanned) ? scanned.error.message : null).toBeNull();
	let parsed = parseSync(filename, source);
	expect(parsed.errors.map((error) => error.message)).toEqual([]);
}

for (let [directory, cases] of Object.entries(CASES)) {
	describe(directory, () => {
		test.each(cases)("$name", (fixtureCase) => {
			let filename = `${fixtureCase.name}.${fixtureCase.extension}`;
			let input = fixture(directory, `${fixtureCase.name}.input.${fixtureCase.extension}.txt`);
			let expected = fixture(directory, `${fixtureCase.name}.output.${fixtureCase.extension}.txt`);
			expectValid(filename, input);

			let edit: Edit = unwrap(fixtureCase.run(filename, input));

			expect(edit.source).toBe(expected);
			expect(edit.changed).toBe(true);
			expect(edit.unhandled).toHaveLength(fixtureCase.unhandled ?? 0);
			expectValid(filename, edit.source);
		});
	});
}

describe("edit failures and no-ops", () => {
	test("addProperty fails on an existing key and on a missing call", () => {
		let source = "export default jobs({ digest: job() });\n";

		let duplicate = addProperty("a.ts", source, { call: "jobs", key: "digest", value: "job()" });
		let missing = addProperty("a.ts", source, { call: "route", key: "home", value: 'get("/")' });

		expect(isFailure(duplicate) && duplicate.error.message).toBe("a.ts: `digest` already exists");
		expect(isFailure(missing) && missing.error.code).toBe("not-found");
	});

	test("addProperty fails when no call passes an object literal at the argument asked for", () => {
		let source = "let sitemap = fromRoutes(routes, origin, decisions);\n";

		let result = addProperty("a.ts", source, {
			call: "fromRoutes",
			argument: 2,
			key: "home",
			value: "true",
		});

		expect(isFailure(result) && result.error.message).toBe(
			"a.ts: no call to `fromRoutes` with an object literal as argument 2",
		);
	});

	test("addProperty fails when the path reaches a value that is not an object literal", () => {
		let source = "export default jobs({ digest: job() });\n";

		let result = addProperty("a.ts", source, {
			call: "jobs",
			path: ["digest"],
			key: "daily",
			value: "job()",
		});

		expect(isFailure(result) && result.error.message).toBe(
			"a.ts: `digest` is not an object literal",
		);
	});

	test("insertAfterLast fails with neither a call nor a fallback declaration", () => {
		let result = insertAfterLast("a.ts", "export const x = 1;\n", {
			call: "router.map",
			statement: "router.map(a, b);",
			fallbackAfter: "createRouter",
		});

		expect(isFailure(result) && result.error.message).toBe(
			"a.ts: no statement calls `router.map` and no declaration initialized by `createRouter`",
		);
	});

	test("an edit whose output does not scan fails instead of returning it", () => {
		let result = insertAfterLast("a.ts", "router.map(a, b);\n", {
			call: "router.map",
			statement: "router.map(c, {",
		});

		expect(isFailure(result) && result.error.code).toBe("invalid-output");
	});

	test("an edit over input that does not scan fails before computing anything", () => {
		let result = rewriteSpecifiers("a.ts", 'import { a } from "./x.js', () => "./y.js");

		expect(isFailure(result) && result.error.code).toBe("unterminated");
	});

	test("moveImports keeps a second default in a declaration of its own", () => {
		let source =
			'import Ui from "sdxc/ui";\nimport Theme from "sdxc/ui";\nimport { Card } from "sdxc/ui";\n';

		let moved = unwrap(moveImports("a.ts", source, moveToIndex(["default", "Card"])));

		expect(moved.source).toBe(
			'import Ui, { Card } from "~/components/ui/index.js";\nimport Theme from "~/components/ui/index.js";\n',
		);
	});

	test("moveImports reports a namespace import that stays while named imports move", () => {
		let source = 'import * as ui from "sdxc/ui";\nimport { Button } from "sdxc/ui";\n';

		let moved = unwrap(moveImports("a.ts", source, MOVE_BUTTON));

		expect(moved.unhandled.map((reference) => reference.names[0]?.local)).toEqual(["ui"]);
	});

	test("an edit with nothing to change returns the source untouched", () => {
		let source = 'import { Dialog } from "sdxc/ui";\n';

		let moved = unwrap(moveImports("a.ts", source, MOVE_BUTTON));
		let rewritten = unwrap(rewriteSpecifiers("a.ts", source, () => null));

		expect(moved).toEqual({ source, changed: false, unhandled: [] });
		expect(rewritten).toEqual({ source, changed: false, unhandled: [] });
	});
});
